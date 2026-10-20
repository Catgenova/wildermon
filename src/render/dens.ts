import { denStage } from '../game/furniture';
import type { LightSource } from '../game/light';
import type { Side } from '../game/building';
import { VIEWS } from './view';
import { HALF_H, HALF_W, HEIGHT_SCALE, UNITS_PER_TILE } from './iso';
import { drawKind, extentOf, kitOf, paletteFor, type Anim, type Kind } from './beasts';
import { WILDERMON, WILDERMON_STAGES } from './wildermon';
import { rand } from './ivy';
import {
  add, BAKE_STEPS, canvasOf, CREASE_INK, css, dot, drawPads, eyeOfView, faceColour, glyphPath, grassTuft, hex, lightOf, mix, mul, proj, RUNE_GOLD, scaleFor, STONE_INK, TAU, toneOf,
  type Ctx, type Eye, type Pad, type MossPalette, type Pt, type RGB, type Tone, type V3,
} from './runestone';

/**
 * Wildermon beds (`den` in `furniture.ts`), one to a stage, drawn in the
 * runestones' kit (`runestone.ts`): small models in tenths of a metre, put on
 * the screen through the piece's turn (`pieceView`), lit as every piece on
 * the island is, inked, baked for each way they are seen and each scale, and
 * what moves laid over the bake.
 *
 * All three are one nest: a round basket of thick twisted withies with a
 * rolled rim, moss in cushions along the rim with ivy leaves and pink-white
 * blossoms in it, and for a cushion a flower -- a ring of pink petal pillows
 * round cream ones and a tufted gold heart. The small one is that and a curl
 * of vine at its back; the medium one is wider and has a hood of vine arching
 * part of the way over it, a few lavender bells hanging off it; the large one
 * is broader still, its hood three withies that rise off the back of the rim
 * and curl right over it in a spiral, hung all along with bells.
 *
 * The bells glow from inside. By day that is painted in; after dark they
 * throw a soft pool of lavender light into the night's light layer
 * (`denPools`), and their own warm light is added in the bed's place among
 * what is drawn, turned up by what the wash will still take off it
 * (`drawDenLive`) -- never laid over the night after the fact.
 *
 * A bed with a wildermon asleep in it (`DenLook.sleeper`) is baked in two
 * halves round it: the basket's far side, its cushion and whatever stands
 * behind, then the sleeper curled on the cushion in its own coat and
 * markings, breathing, then the near rim and whatever stands in front --
 * and a slow `z` rises off it. Empty, the two halves are one picture.
 */

/* ---- what a bed is -------------------------------------------------------- */

/** The three, by the stage each is sized for: their basket, cushion and hood. */
interface Spec {
  /** The basket's radius at its widest, its height to the top of its rim, and how thick its rolled rim is. */
  R: number;
  H: number;
  T: number;
  /** How many sides its rings have: a low-poly round. */
  sides: number;
  /** Petal pillows in its outer and inner rings. */
  outer: number;
  inner: number;
  /** Clusters of moss round its rim. */
  clusters: number;
  /**
   * Its hood: one spiral of vine up off the back of the rim, how high it
   * rises, how far over it carries (nought stops it at its top, one curls it
   * on past the front and back under itself) and how thick it is; and where
   * the hood is a vault, how far either side of it its edges stand at the
   * rim (a share of `R`) and how far along the spiral the vault runs before
   * the spine curls on alone.
   */
  hood?: Hood;
  /** Bells hanging off the hood. */
  bells: number;
  seed: number;
}

interface Hood { high: number; over: number; thick: number; side: number; vault: number }

const SPECS: Record<0 | 1 | 2, Spec> = {
  0: { R: 4.5, H: 2.4, T: 0.95, sides: 14, outer: 6, inner: 0, clusters: 3, bells: 0, seed: 101 },
  1: { R: 8.6, H: 4.6, T: 1.45, sides: 18, outer: 8, inner: 6, clusters: 5, hood: { high: 10.5, over: 0.3, thick: 1.1, side: 0.55, vault: 0.5 }, bells: 5, seed: 202 },
  2: { R: 13.0, H: 5.8, T: 1.85, sides: 22, outer: 10, inner: 8, clusters: 7, hood: { high: 21.5, over: 0.72, thick: 1.5, side: 0.6, vault: 0.62 }, bells: 14, seed: 303 },
};

/* ---- the palette ------------------------------------------------------------ */

/** The willow: warm honey brown in the light, a warm mauve-brown turned from it, and the strands' lights and darks. */
const WILLOW: Tone = toneOf('#d3a473', '#8c6660');
const WILLOW_IN: Tone = toneOf('#b98a63', '#7a5856');
const STRAND_LIT: RGB = hex('#ecc898');
const STRAND_DARK: RGB = hex('#8a6150');
/** The vine of the hood: a step greener and darker than the basket. */
const VINE: Tone = toneOf('#bc9468', '#7a5e52');
const VINE_LIT: RGB = hex('#d8b688');
/** The hood's woven vault: its outside in the light, and its underside, seen from under it, a step darker. */
const HOOD: Tone = toneOf('#8a8250', '#565239');
/** The rope's twisted strands, a step paler than its core so the twist reads. */
const VINE_STRAND: Tone = toneOf('#cfa679', '#86685a');
const HOOD_UNDER: Tone = toneOf('#a8916a', '#6e5e51');
/** The ink: the kit's warm grey-brown, a step browner for wood. */
const INK_COLOUR: RGB = mix(STONE_INK, hex('#5a3a30'), 0.35);
const INK = 0.7;
/** The petals: pink, cream, and the gold heart. */
const PINK: Tone = toneOf('#f5b6c2', '#c7869b');
const CREAM: Tone = toneOf('#fdf0e2', '#d9b5b5');
const GOLD: Tone = toneOf('#f5d47e', '#c39c58');
const PETAL_INK: RGB = hex('#a86e7a');
/** Moss in the reference's olive, kept in the kit's cushions (`drawPads`). */
const DEN_MOSS: MossPalette = { line: '#5c6a3c', dark: '#6b7b42', under: '#86984e', fill: '#a3b45f', lit: '#c4d07c', top: '#dfe49e' };
/** Ivy leaves: lit, shade, rim, vein. */
const LEAF = { lit: '#9fbb64', shade: '#7c9a52', line: '#4f6438', vein: '#c7d98e' };
/** The blossoms: petals, their blush, the eye. */
const BLOSSOM = { petal: '#fff3f1', blush: '#f4b8c6', eye: '#f2c94c', line: '#b47a86' };
/** The bells: lavender at the cap going pink toward the mouth, and the light in them. */
const BELL = { cap: '#b9a2e0', mouth: '#f2cde6', line: '#7d68a8', glow: '#fff4cf' };

/* ---- the kit's pieces ------------------------------------------------------ */

/** One face of a solid: its corners, which way it faces, its colours, and what is painted in its frame (x along it from `s0`, y up from `z0`). */
interface DenFace {
  pts: V3[];
  n: V3;
  tone: Tone;
  frame?: { o: V3; a: V3; b: V3 };
  paint?: (g: Ctx, fill: RGB, L: number) => void;
  crease?: number;
}

/** Something in the bed, laid in its turn: before the sleeper or after, back to front. */
interface Part {
  /** Where it falls in the order from this eye: more is later. */
  order: (e: Eye) => number;
  /** Lay it; with `cut`, lay only its shape, for taking it out of what is behind (the bells' light). */
  draw: (g: Ctx, e: Eye, scale: number, cut: boolean) => void;
  /** Points it reaches, for the size of the picture, and whether it is what the bed is clicked by. */
  reach: V3[];
  solid?: boolean;
  /** A bell's light, laid with it into its glow (`BellLight`). */
  bells?: (e: Eye) => Array<{ at: V3; r: number; top: V3; drop: number }>;
}

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** The vault's weave, in a face's frame: withies running along the hood, a dark gap and a lit back to each. */
function hoodWeave(g: Ctx, fill: RGB, len: number, k: number, side: number): void {
  for (let j = 0; j < 4; j++) {
    const y = (j + 0.5) / 4;
    g.fillStyle = css(mix(fill, STRAND_DARK, 0.5), 0.7);
    g.fillRect(-0.5, y - 0.06, len + 1, 0.06);
    g.fillStyle = css(mix(fill, STRAND_LIT, 0.4), 0.55);
    g.fillRect(-0.5, y + 0.02, len + 1, 0.07);
  }
  // A cross-withy now and then.
  if ((k + (side > 0 ? 1 : 0)) % 3 === 0) {
    g.fillStyle = css(mix(fill, STRAND_DARK, 0.4), 0.6);
    g.fillRect(len * 0.4, -0.1, len * 0.18, 1.2);
  }
}
const centre = (pts: readonly V3[]): V3 => mul(pts.reduce<V3>((m, p) => add(m, p), [0, 0, 0]), 1 / pts.length);
const near = (e: Eye, p: V3): number => dot(p, e.toward);

function polyPath(g: Ctx, e: Eye, pts: readonly V3[]): void {
  g.beginPath();
  pts.forEach((p, i) => { const [x, y] = proj(e, p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.closePath();
}

/** Faces the eye sees, back to front. */
const seen = (e: Eye, faces: readonly DenFace[]): DenFace[] => faces.filter((f) => dot(f.n, e.toward) > 1e-6)
  .map((f) => ({ f, d: near(e, centre(f.pts)) })).sort((a, b) => a.d - b.d).map((x) => x.f);

/** The ink round a set of faces: each stroked twice the ink wide, to be filled over so only the rim of the whole is left. */
function inkFaces(g: Ctx, e: Eye, faces: readonly DenFace[], ink = INK, colour: RGB = INK_COLOUR): void {
  g.lineJoin = 'round';
  g.strokeStyle = css(colour);
  g.lineWidth = ink * 2;
  for (const f of seen(e, faces)) { polyPath(g, e, f.pts); g.stroke(); }
}

/** Fill faces back to front, each lit, painted in its frame and creased (`drawFaces` in `runestone.ts`, without the ink). */
function fillFaces(g: Ctx, e: Eye, faces: readonly DenFace[], cut: boolean): void {
  for (const f of seen(e, faces)) {
    polyPath(g, e, f.pts);
    if (cut) { g.fill(); continue; }
    const L = lightOf(e, f.n);
    const fill = faceColour(f.tone, L);
    g.fillStyle = css(fill);
    g.fill();
    g.strokeStyle = css(fill);
    g.lineWidth = 0.5;
    g.stroke();
    if (f.paint && f.frame) {
      g.save();
      polyPath(g, e, f.pts);
      g.clip();
      const [ox, oy] = proj(e, f.frame.o), [ax, ay] = proj(e, f.frame.a), [bx, by] = proj(e, f.frame.b);
      g.transform(ax, ay, bx, by, ox, oy);
      f.paint(g, fill, L);
      g.restore();
    }
    polyPath(g, e, f.pts);
    g.strokeStyle = css(mix(fill, CREASE_INK, 0.6), f.crease ?? 0.3);
    g.lineWidth = 0.5;
    g.stroke();
  }
}

/** A point on a ring round the bed's middle, at angle `a` (nought along its width, a quarter turn toward its front). */
const onRing = (r: number, a: number, z: number): V3 => [r * Math.cos(a), r * Math.sin(a), z];

/**
 * A solid of revolution about the bed's middle, from a profile of (radius,
 * height) points: each step of the profile a band of faces round it, its
 * normal off the profile's own slope -- out and up on the outside of the
 * basket, in and up on its inside. `dress` paints each band.
 */
function lathe(profile: readonly Pt[], sides: number, phase: number, tone: (k: number) => Tone, dress?: (k: number, i: number, s0: number, z0: number, w: number) => DenFace['paint'], crease?: (k: number) => number): DenFace[][] {
  const bands: DenFace[][] = [];
  for (let k = 0; k + 1 < profile.length; k++) {
    const [r0, z0] = profile[k], [r1, z1] = profile[k + 1];
    const dr = r1 - r0, dz = z1 - z0, l = Math.hypot(dr, dz) || 1;
    const nr = dz / l, nz = -dr / l;
    const band: DenFace[] = [];
    let s0 = 0;
    for (let i = 0; i < sides; i++) {
      const a0 = phase + (i / sides) * TAU, a1 = phase + ((i + 1) / sides) * TAU, am = (a0 + a1) / 2;
      const pts = [onRing(r0, a0, z0), onRing(r0, a1, z0), onRing(r1, a1, z1), onRing(r1, a0, z1)];
      const n: V3 = [nr * Math.cos(am), nr * Math.sin(am), nz];
      // Its frame from its lower edge, across and up: a unit up it a unit of height where it rises at all.
      const [lo0, lo1, hi0] = z0 <= z1 ? [pts[0], pts[1], pts[3]] : [pts[3], pts[2], pts[0]];
      const along: V3 = [lo1[0] - lo0[0], lo1[1] - lo0[1], 0];
      const w = Math.hypot(along[0], along[1]);
      const a = mul(along, 1 / w);
      const up: V3 = [hi0[0] - lo0[0], hi0[1] - lo0[1], hi0[2] - lo0[2]];
      const b = up[2] > 0.05 ? mul(up, 1 / up[2]) : mul(up, 1 / (Math.hypot(...up) || 1));
      band.push({ pts, n, tone: tone(k), frame: { o: lo0, a, b }, paint: dress?.(k, i, s0, Math.min(z0, z1), w), crease: crease?.(k) });
      s0 += w;
    }
    bands.push(band);
  }
  return bands;
}

/**
 * The willow's weave on a side, in its frame: rows of thick twisted withies
 * a strand high, each a run of slanted twists lit along their upper edge and
 * cut dark between; the rows' joins dark. Where it is fine enough to be seen,
 * a few withies cross the rows on the slant, as a woven basket's do.
 */
function weave(g: Ctx, fill: RGB, w: number, s0: number, z0: number, h: number, row: number, fine: boolean, seed: number, inner = false): void {
  const T = rand(seed);
  const first = Math.floor(z0 / row) * row;
  for (let z = first; z < z0 + h + row; z += row) {
    const y = z - z0, k = Math.round(z / row);
    // The row's join.
    g.fillStyle = css(mix(fill, STRAND_DARK, inner ? 0.55 : 0.45), 0.9);
    g.fillRect(-1, y - row * 0.1, w + 2, row * 0.2);
    // Its light along its top.
    g.fillStyle = css(mix(fill, STRAND_LIT, inner ? 0.2 : 0.45), 0.7);
    g.fillRect(-1, y + row * 0.55, w + 2, row * 0.22);
    if (!fine) continue;
    // The twists: slanted cuts across the strand, offset row by row.
    const step = row * 1.15;
    g.strokeStyle = css(mix(fill, STRAND_DARK, 0.6), 0.75);
    g.lineWidth = row * 0.12;
    g.beginPath();
    for (let x = -((s0 + k * step * 0.5) % step); x < w + step; x += step) {
      g.moveTo(x, y + row * 0.12);
      g.lineTo(x + row * 0.5, y + row * 0.88);
    }
    g.stroke();
  }
  if (!fine || inner) return;
  // A withy or two across the rows on the slant.
  for (let i = 0; i < 1; i++) {
    if (T() < 0.45) continue;
    const x = T() * w, d = (T() < 0.5 ? -1 : 1) * h * 0.5;
    g.strokeStyle = css(mix(fill, STRAND_DARK, 0.5), 0.8);
    g.lineWidth = row * 0.75;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - d, 0.2);
    g.lineTo(x + d, h - 0.2);
    g.stroke();
    g.strokeStyle = css(mix(fill, STRAND_LIT, 0.5), 0.8);
    g.lineWidth = row * 0.25;
    g.stroke();
  }
}

/** The rolled rim's twist: dark slanted cuts round it, a light between. */
function twist(g: Ctx, fill: RGB, w: number, s0: number, h: number, pitch: number, fine: boolean): void {
  g.fillStyle = css(mix(fill, STRAND_LIT, 0.35), 0.5);
  g.fillRect(-1, h * 0.35, w + 2, h * 0.3);
  g.strokeStyle = css(mix(fill, STRAND_DARK, 0.62), fine ? 0.85 : 0.55);
  g.lineWidth = pitch * (fine ? 0.16 : 0.22);
  g.beginPath();
  for (let x = -(s0 % pitch); x < w + pitch; x += pitch) {
    g.moveTo(x - h * 0.4, -0.2);
    g.lineTo(x + h * 0.4, h + 0.2);
  }
  g.stroke();
}

/* ---- the little things: leaves, blossoms, bells ---------------------------- */

/** An ivy leaf at (x, y) on the screen, `s` across, turned `a`: three lobes, a vein, inked. */
function leaf(g: Ctx, x: number, y: number, s: number, a: number, lit: boolean, cut: boolean): void {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(-0.55 * s, -0.05 * s, -0.75 * s, -0.55 * s, -0.32 * s, -0.62 * s);
  g.bezierCurveTo(-0.3 * s, -0.95 * s, 0.3 * s, -0.95 * s, 0.32 * s, -0.62 * s);
  g.bezierCurveTo(0.75 * s, -0.55 * s, 0.55 * s, -0.05 * s, 0, 0);
  g.closePath();
  if (cut) { g.fill(); g.restore(); return; }
  g.fillStyle = lit ? LEAF.lit : LEAF.shade;
  g.fill();
  g.strokeStyle = LEAF.line;
  g.lineWidth = Math.max(0.45, s * 0.09);
  g.stroke();
  if (s > 2.2) {
    g.beginPath();
    g.moveTo(0, -0.08 * s);
    g.lineTo(0, -0.7 * s);
    g.strokeStyle = LEAF.vein;
    g.lineWidth = s * 0.06;
    g.stroke();
  }
  g.restore();
}

/** A blossom at (x, y), `r` across its petals: five, white blushed pink at the heart, a gold eye. */
function blossom(g: Ctx, x: number, y: number, r: number, a: number, cut: boolean): void {
  g.save();
  g.translate(x, y);
  g.scale(1, 0.8);
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const t = a + (i / 5) * TAU;
    g.moveTo(Math.cos(t) * r * 0.55 + r * 0.45, Math.sin(t) * r * 0.55);
    g.ellipse(Math.cos(t) * r * 0.55, Math.sin(t) * r * 0.55, r * 0.45, r * 0.36, t, 0, TAU);
  }
  if (cut) { g.fill(); g.restore(); return; }
  g.strokeStyle = BLOSSOM.line;
  g.lineWidth = Math.max(0.45, r * 0.16);
  g.stroke();
  g.fillStyle = BLOSSOM.petal;
  g.fill();
  if (r > 1.4) {
    g.beginPath();
    g.arc(0, 0, r * 0.5, 0, TAU);
    g.fillStyle = css(hex(BLOSSOM.blush), 0.7);
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, r * 0.24, 0, TAU);
  g.fillStyle = BLOSSOM.eye;
  g.fill();
  g.restore();
}

/** A bell at (x, y), the point it hangs from on the screen, `h` tall: a stem, a lavender cap flaring to a scalloped pink mouth, lit inside. */
function bell(g: Ctx, x: number, y: number, h: number, stem: number, cut: boolean): void {
  const top = y + stem, w = h * 0.36;
  if (!cut) {
    g.strokeStyle = LEAF.line;
    g.lineWidth = Math.max(0.4, h * 0.08);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + h * 0.18, y + stem * 0.5, x, top);
    g.stroke();
  }
  const path = (): void => {
    g.beginPath();
    g.moveTo(x - w * 0.5, top + h * 0.12);
    g.quadraticCurveTo(x, top - h * 0.12, x + w * 0.5, top + h * 0.12);
    g.quadraticCurveTo(x + w * 0.62, top + h * 0.62, x + w * 1.08, top + h * 0.92);
    // The scalloped mouth, five lobes.
    for (let i = 4; i >= 0; i--) {
      const x0 = x - w * 1.08 + (2.16 * w * i) / 5;
      g.quadraticCurveTo(x0 + (2.16 * w) / 10, top + h * 1.08, x0, top + h * 0.92);
    }
    g.quadraticCurveTo(x - w * 0.62, top + h * 0.62, x - w * 0.5, top + h * 0.12);
    g.closePath();
  };
  path();
  if (cut) { g.fill(); return; }
  const gr = g.createLinearGradient(0, top, 0, top + h);
  gr.addColorStop(0, BELL.cap);
  gr.addColorStop(0.75, BELL.mouth);
  gr.addColorStop(1, '#fbe6f0');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = BELL.line;
  g.lineWidth = Math.max(0.45, h * 0.07);
  g.stroke();
  // Its light inside, showing at the mouth.
  const lg = g.createRadialGradient(x, top + h * 0.95, 0, x, top + h * 0.95, w * 1.2);
  lg.addColorStop(0, BELL.glow);
  lg.addColorStop(1, 'rgba(255, 244, 207, 0)');
  g.fillStyle = lg;
  g.beginPath();
  g.ellipse(x, top + h * 0.9, w * 0.95, h * 0.2, 0, 0, TAU);
  g.fill();
  // The calyx at its cap.
  g.fillStyle = LEAF.shade;
  g.beginPath();
  g.ellipse(x, top + h * 0.06, w * 0.42, h * 0.1, 0, 0, TAU);
  g.fill();
}

/* ---- the model --------------------------------------------------------------- */

/** How a bed is drawn: who sleeps in it, if anybody, in their own coat and markings. */
export interface DenLook {
  /**
   * Who sleeps in it: its kind and the stage it is drawn at (`stageOf`), its
   * variant's coat and markings, and a number of its own for its breath.
   * Without a kind, or for one not drawn as a model, a curl in its colours.
   */
  sleeper?: { colors: [string, string]; seed?: number; species?: string; stage?: number };
}

interface Model {
  spec: Spec;
  /** Its basket, in two halves for each eye (`split`): its faces, all of them. */
  basket: DenFace[];
  /** The inner lip of the rim, round from its first corner: inked where it stands over the cushion. */
  lip: V3[];
  parts: Part[];
  /** The cushion's top, and its middle: where a sleeper lies. */
  zc: number;
  ri: number;
  /** The ground it covers, for its shade. */
  foot: number;
  /** Where its bells hang, on average, in the model: across, toward its front, and up (their mouths). Nothing for a bed with none. */
  bellsAt?: V3;
}

const models = new Map<number, Model>();

/**
 * The hood's withy: up off the back of the rim, over the top and round into
 * a spiral, as points in the model. It winds round a middle over the back of
 * the basket, drawing in as it goes: `over` nought stops it at its top, one
 * carries it on past the front and curls it down and back under itself.
 */
function archPath(sp: Spec, hd: Hood, xAt: (u: number) => number, u1 = 1, n = 28): V3[] {
  const { R, H } = sp;
  const { high, over } = hd;
  const base: V3 = [xAt(0), -R * 0.9, H - 0.3];
  const cy = -R * 0.5 + R * 0.42 * over, cz = H + (high - H) * 0.45;
  // An oval spiral, wider along the bed than it is tall, so the hood leans out over it rather than standing up off it.
  const rho0 = Math.hypot((base[1] - cy) / OVAL[0], (base[2] - cz) / OVAL[1]);
  let th0 = Math.atan2((base[2] - cz) / OVAL[1], (base[1] - cy) / OVAL[0]);
  if (th0 < 0) th0 += TAU;
  const th1 = Math.PI * (0.5 - 1.4 * over);
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * u1, th = th0 - (th0 - th1) * u;
    const rho = rho0 * (1 - 0.74 * Math.pow(u, 1.5));
    pts.push([xAt(u), cy + Math.cos(th) * rho * OVAL[0], cz + Math.sin(th) * rho * OVAL[1]]);
  }
  return pts;
}
/** How much wider along the bed than tall the hood's spiral is. */
const OVAL: [number, number] = [1.15, 0.85];
/** The middle the hood's spiral winds round, in the model's (y, z). */
const hoodMiddle = (sp: Spec, hd: Hood): [number, number] => [-sp.R * 0.5 + sp.R * 0.42 * hd.over, sp.H + (hd.high - sp.H) * 0.45];

/**
 * A withy as a tube: inked, its body, a light along its top, and a twist cut
 * round it, laid as strokes on the screen through its points, so it is round
 * from every side.
 */
function tube(g: Ctx, e: Eye, pts: readonly V3[], r0: number, r1: number, tone: Tone, cut: boolean, fine: boolean): void {
  const scr = pts.map((p) => proj(e, p));
  const k = Math.hypot(e.ux, e.uy) * 1.2;
  const seg = (lw: (u: number) => number, colour: string, dy = 0): void => {
    g.strokeStyle = colour;
    for (let i = 1; i < scr.length; i++) {
      const u = i / (scr.length - 1);
      g.lineWidth = lw(u);
      g.beginPath();
      g.moveTo(scr[i - 1][0], scr[i - 1][1] + dy);
      g.lineTo(scr[i][0], scr[i][1] + dy);
      g.stroke();
    }
  };
  const rad = (u: number): number => (r0 + (r1 - r0) * u) * k;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (cut) { seg((u) => 2 * rad(u) + 2 * INK, '#000'); return; }
  seg((u) => 2 * rad(u) + 2 * INK, css(INK_COLOUR));
  seg((u) => 2 * rad(u), css(faceColour(tone, 0.8)));
  seg((u) => rad(u) * 0.9, css(faceColour(tone, 1)), -0.25 * k * r0);
  seg((u) => rad(u) * 0.35, css(mix(faceColour(tone, 1), VINE_LIT, 0.7)), -0.45 * k * r0);
  if (!fine) return;
  // The twist: short dark cuts across it, a strand's pitch apart.
  g.strokeStyle = css(mix(faceColour(tone, 0.8), STRAND_DARK, 0.7), 0.8);
  let acc = 0;
  for (let i = 1; i < scr.length; i++) {
    const [ax, ay] = scr[i - 1], [bx, by] = scr[i];
    const l = Math.hypot(bx - ax, by - ay);
    if (l < 1e-6) continue;
    const tx = (bx - ax) / l, ty = (by - ay) / l;
    const u = i / (scr.length - 1), r = rad(u), pitch = Math.max(1.2, r * 1.6);
    g.lineWidth = Math.max(0.35, r * 0.22);
    for (let d = pitch - acc; d < l; d += pitch) {
      const px = ax + tx * d, py = ay + ty * d;
      g.beginPath();
      g.moveTo(px - ty * r * 0.9 - tx * r * 0.45, py + tx * r * 0.9 - ty * r * 0.45);
      g.lineTo(px + ty * r * 0.9 + tx * r * 0.45, py - tx * r * 0.9 + ty * r * 0.45);
      g.stroke();
    }
    acc = (acc + l) % pitch;
  }
}

/**
 * A cluster of moss at points of the model: cushions laid on the screen at
 * zoom one (`drawPads`, in the reference's olive), ivy leaves out of it, a
 * blossom or two in it; fewer and bigger things where the bake is small, so
 * at the furthest zoom it is a clump with a flower in it and not a speckle.
 */
function clusterDraw(pads: Array<[V3, number]>, leaves: Array<[V3, number, number]>, flowers: Array<[V3, number]>) {
  return (g: Ctx, e: Eye, scale: number, cut: boolean): void => {
    const across = Math.hypot(e.ux, e.uy) * 0.9;
    const ps: Pad[] = pads.map(([p, r]) => { const [x, y] = proj(e, p); return [x, y, r * across, r * across * 0.72]; });
    if (cut) {
      g.beginPath();
      for (const [x, y, rx, ry] of ps) { g.moveTo(x + rx, y); g.ellipse(x, y, rx * 1.1, ry * 1.1, 0, 0, TAU); }
      g.fill();
    }
    const fine = scale >= 2;
    for (const [p, s, a] of leaves) {
      if (!fine && s < 1.6) continue;
      const [x, y] = proj(e, p);
      leaf(g, x, y, s * across, a, s > 1.8, cut);
    }
    if (!cut) drawPads(g, ps, DEN_MOSS);
    for (const [p, r] of flowers) {
      if (r < 1.1 && scale < 3) continue;
      const [x, y] = proj(e, p);
      blossom(g, x, y, r * across, p[0] * 0.7, cut);
    }
  };
}

function modelOf(stage: 0 | 1 | 2): Model {
  const had = models.get(stage);
  if (had) return had;
  const sp = SPECS[stage];
  const { R, H, T } = sp;
  const R0 = rand(sp.seed);
  const phase = 0.13;
  const zc = H * 0.72;
  const ri = R - T * 1.15;
  /*
   * The basket's profile, foot to lip and down its inside: flaring out from a
   * narrow foot to its widest, in under the rolled rim, round the roll and
   * down the inside to where the cushion lies in it.
   */
  const profile: Pt[] = [
    [R * 0.72, -0.3], [R * 0.94, H * 0.3], [R, H * 0.58], [R - T * 0.08, H - T * 1.05],
    [R + T * 0.32, H - T * 0.72], [R + T * 0.2, H - T * 0.18], [R - T * 0.38, H], [R - T * 0.95, H - T * 0.22],
    [ri, H - T * 0.8], [ri - 0.3, zc],
  ];
  const row = stage === 0 ? 0.85 : stage === 1 ? 1.05 : 1.25;
  const bands = lathe(profile, sp.sides, phase,
    (k) => (k >= 7 ? WILLOW_IN : WILLOW),
    (k, i, s0, z0, w) => {
      const h = Math.abs(profile[k + 1][1] - profile[k][1]);
      if (k <= 2) return (g, fill) => weave(g, fill, w + 0.5, s0, z0, h + 0.5, row, true, sp.seed + i * 7 + k);
      if (k >= 7) return (g, fill) => weave(g, fill, w + 0.5, s0, z0, h + 0.5, row, false, sp.seed + i * 5 + k, true);
      // The roll: one twisted withy round, its cuts on the slant across the bands of its round.
      return (g, fill) => twist(g, fill, w + 0.5, s0 + k * 0.4, 1.4, T * 1.05, true);
    },
    (k) => (k === 3 ? 0.6 : k >= 4 && k <= 6 ? 0.18 : 0.3));
  const basket = bands.flat();
  const lip = Array.from({ length: sp.sides + 1 }, (_, i) => onRing(R - T * 0.95, phase + (i / sp.sides) * TAU, H - T * 0.22));

  const parts: Part[] = [];

  /* -- the cushion: the floor of it, a ring of pink petal pillows, cream ones over them, and the gold heart -- */
  const rcGold = heartOf({ ri, spec: sp });
  const petals: Array<{ a: number; r0: number; r1: number; w: number; z: number; tone: Tone; puff: number }> = [];
  for (let i = 0; i < sp.outer; i++) petals.push({ a: (i / sp.outer) * TAU + 0.2, r0: rcGold * 0.6, r1: ri - 0.1, w: ((TAU * ri * 0.62) / sp.outer) * 1.05, z: zc, tone: PINK, puff: 0.55 + 0.12 * sp.T });
  for (let i = 0; i < sp.inner; i++) petals.push({ a: ((i + 0.5) / sp.inner) * TAU + 0.2, r0: rcGold * 0.5, r1: ri * 0.66, w: ((TAU * ri * 0.4) / sp.inner) * 0.95, z: zc + 0.55, tone: CREAM, puff: 0.5 + 0.1 * sp.T });
  const petalOutline = (p: (typeof petals)[number], dz: number): V3[] => {
    const out: V3[] = [];
    const c = Math.cos(p.a), s = Math.sin(p.a);
    const N = 11;
    for (let side = -1; side <= 1; side += 2) {
      for (let j = 0; j <= N; j++) {
        const u = side < 0 ? j / N : 1 - j / N;
        const r = p.r0 + (p.r1 - p.r0) * u;
        // A rounded pillow, widest a little past its middle and blunt at both ends.
        const half = p.w * Math.pow(Math.max(0, 1 - Math.pow((u - 0.56) / 0.56, 2)), 0.42) * (0.62 + 0.38 * u);
        const z = p.z + dz + (H - zc + 0.4) * Math.pow(u, 2.5) * (p.r1 > ri * 0.8 ? 1 : 0.3);
        out.push([r * c - side * half * s, r * s + side * half * c, z]);
      }
    }
    return out;
  };
  parts.push({
    order: () => -1e8,
    reach: [onRing(ri, 0, zc + 1), onRing(ri, Math.PI, zc + 1)],
    draw: (g, e, scale, cut) => {
      // The floor of the cushion, so nothing of the basket shows between the petals.
      polyPath(g, e, Array.from({ length: 24 }, (_, i) => onRing(ri - 0.2, (i / 24) * TAU, zc - 0.1)));
      g.fillStyle = cut ? '#000' : css(faceColour(PINK, 0.62));
      g.fill();
      if (cut) return;
      const order = petals.map((p) => ({ p, d: near(e, onRing((p.r0 + p.r1) / 2, p.a, p.z)) + (p.tone === CREAM && sp.inner ? 1e3 : 0) })).sort((a, b) => a.d - b.d);
      for (const { p } of order) {
        const lit = p.tone;
        // Its depth: the outline a step down in its shade, then its top.
        polyPath(g, e, petalOutline(p, -0.45));
        g.fillStyle = css(faceColour(lit, 0.6));
        g.fill();
        g.strokeStyle = css(mix(faceColour(lit, 0.6), PETAL_INK, 0.6));
        g.lineWidth = 0.55;
        g.stroke();
        const top = petalOutline(p, 0);
        polyPath(g, e, top);
        g.fillStyle = css(faceColour(lit, 0.97));
        g.fill();
        g.strokeStyle = css(mix(faceColour(lit, 0.6), PETAL_INK, 0.75));
        g.lineWidth = 0.6;
        g.stroke();
        // Its puff: a light along its spine toward the sun, and its seam.
        const c = Math.cos(p.a), s = Math.sin(p.a);
        const spine = (k: number, dz: number): V3 => { const r = p.r0 + (p.r1 - p.r0) * k; return [r * c, r * s, p.z + dz + (H - zc + 0.4) * Math.pow(k, 2.5) * (p.r1 > ri * 0.8 ? 1 : 0.3)]; };
        const [ax, ay] = proj(e, spine(0.22, p.puff)), [bx, by] = proj(e, spine(0.82, p.puff));
        g.lineCap = 'round';
        g.strokeStyle = css(mix(faceColour(lit, 1), [255, 255, 255], 0.55), 0.85);
        g.lineWidth = Math.max(0.8, p.w * 0.55 * Math.hypot(e.ux, e.uy));
        g.beginPath();
        g.moveTo(ax - 0.4, ay - 0.5);
        g.lineTo(bx - 0.4, by - 0.5);
        g.stroke();
        if (scale >= 2) {
          g.setLineDash([0.6, 0.55]);
          g.strokeStyle = css(mix(faceColour(lit, 0.8), PETAL_INK, 0.4), 0.7);
          g.lineWidth = 0.3;
          polyPath(g, e, petalOutline(p, 0.05).map((q, j, all) => { const m = centre(all); return [m[0] + (q[0] - m[0]) * 0.82, m[1] + (q[1] - m[1]) * 0.82, q[2]] as V3; }));
          g.stroke();
          g.setLineDash([]);
        }
      }
      // The gold heart: a low dome of tufts.
      const ring = (r: number, z: number): V3[] => Array.from({ length: 16 }, (_, i) => onRing(r, (i / 16) * TAU, z));
      const zg = zc + (sp.inner ? 0.75 : 0.45);
      polyPath(g, e, ring(rcGold, zg));
      g.fillStyle = css(faceColour(GOLD, 0.62));
      g.fill();
      g.strokeStyle = css(mix(faceColour(GOLD, 0.6), INK_COLOUR, 0.6));
      g.lineWidth = 0.6;
      g.stroke();
      polyPath(g, e, ring(rcGold * 0.84, zg + 0.55));
      g.fillStyle = css(faceColour(GOLD, 1));
      g.fill();
      const across = Math.hypot(e.ux, e.uy);
      const T2 = rand(sp.seed + 9);
      const tufts = scale >= 2 ? [[0.62, 12], [0.32, 7]] : [[0.5, 6]];
      for (const [k, n] of tufts) for (let i = 0; i < n; i++) {
        const [x, y] = proj(e, onRing(rcGold * k, (i / n) * TAU + T2(), zg + 0.6));
        g.beginPath();
        g.arc(x, y, Math.max(0.5, rcGold * 0.16 * across), 0, TAU);
        g.fillStyle = css(mix(faceColour(GOLD, 1), [255, 250, 225], 0.55));
        g.fill();
        g.strokeStyle = css(faceColour(GOLD, 0.55), 0.8);
        g.lineWidth = 0.3;
        g.stroke();
      }
    },
  });

  /* -- the basket itself, its far half and its near half, an eye at a time -- */
  const axis: V3 = [0, 0, 0];
  const isNear = (e: Eye, f: DenFace): boolean => near(e, [centre(f.pts)[0], centre(f.pts)[1], 0]) > near(e, axis);
  parts.push({
    order: () => -1e9,
    solid: true,
    reach: basket.flatMap((f) => f.pts),
    draw: (g, e, _s, cut) => {
      if (!cut) inkFaces(g, e, basket);
      fillFaces(g, e, basket.filter((f) => !isNear(e, f)), cut);
    },
  });
  parts.push({
    order: (e) => near(e, axis) + 0.01,
    solid: true,
    reach: basket.flatMap((f) => f.pts),
    draw: (g, e, _s, cut) => {
      fillFaces(g, e, basket.filter((f) => isNear(e, f)), cut);
      if (cut) return;
      // The lip, inked where it stands over the cushion: its near half.
      g.strokeStyle = css(INK_COLOUR);
      g.lineWidth = INK * 1.6;
      g.lineCap = 'round';
      g.beginPath();
      let on = false;
      for (const p of lip) {
        const front = near(e, [p[0], p[1], 0]) > near(e, axis) - 0.05;
        const [x, y] = proj(e, p);
        if (front && on) g.lineTo(x, y);
        else if (front) { g.moveTo(x, y); on = true; } else on = false;
      }
      g.stroke();
    },
  });

  /* -- moss round the rim, in clusters, with ivy and blossoms -- */
  for (let c = 0; c < sp.clusters; c++) {
    const a0 = phase + (c / sp.clusters) * TAU + (R0() - 0.5) * 0.5;
    const span = (stage === 0 ? 0.9 : 0.55) + R0() * 0.25;
    const pads: Array<[V3, number]> = [];
    const leaves: Array<[V3, number, number]> = [];
    const flowers: Array<[V3, number]> = [];
    const n = 4 + Math.round(span * (3 + stage * 2));
    for (let j = 0; j < n; j++) {
      const a = a0 + (j / (n - 1) - 0.5) * span;
      const r = R - T * (0.2 + R0() * 0.5);
      pads.push([onRing(r, a, H + 0.2 + R0() * 0.3), (0.55 + R0() * 0.45) * (0.8 + 0.25 * stage) * (j % 2 ? 0.85 : 1.1)]);
    }
    const nl = 2 + stage;
    for (let j = 0; j < nl; j++) {
      const a = a0 + (R0() - 0.5) * span;
      const out = R0() < 0.6;
      // Out over the rim, drooping down its side, or up out of the moss.
      const p = out ? onRing(R + T * 0.5, a, H - 0.4 - R0() * 1.2) : onRing(R - T * 0.4, a, H + 0.6);
      leaves.push([p, (1.4 + R0() * 0.9) * (0.85 + 0.15 * stage), out ? Math.PI + (R0() - 0.5) * 1.4 : (R0() - 0.5) * 1.6]);
    }
    const nf = c % 2 === 0 || stage === 2 ? 1 : 0;
    for (let j = 0; j < nf; j++) flowers.push([onRing(R - T * 0.35, a0 + (R0() - 0.5) * span * 0.6, H + 0.7), 1.25 + 0.2 * stage + R0() * 0.2]);
    for (let j = 0; j < 2 + stage; j++) flowers.push([onRing(R - T * 0.2, a0 + (R0() - 0.5) * span, H + 0.5), 0.6 + R0() * 0.3]);
    const mid = onRing(R, a0, H);
    parts.push({
      order: (e) => near(e, mid) + (near(e, [mid[0], mid[1], 0]) > 0 ? 0.02 : 0),
      reach: pads.map(([p]) => [p[0], p[1], p[2] + 1.5] as V3),
      draw: clusterDraw(pads, leaves, flowers),
    });
  }

  /*
   * -- a rune cut into the front of the basket under its rim and gilded, as
   * the runestones' are: the kit's mark on its nest, small, on the weave --
   */
  if (stage > 0) {
    const at = 0.95, r = 0.75 + 0.25 * stage;
    const out: V3 = [Math.cos(at), Math.sin(at), 0], across: V3 = [-Math.sin(at), Math.cos(at), 0], up: V3 = [0, 0, 1];
    const c = onRing(R * 1.005, at, H * 0.56);
    parts.push({
      order: (e) => near(e, [c[0], c[1], 0]) + 0.05,
      reach: [c],
      draw: (g, e, scale, cut) => {
        if (cut || dot(out, e.toward) <= 0.1) return;
        const [ox, oy] = proj(e, c), [ax, ay] = proj(e, across), [bx, by] = proj(e, up);
        g.save();
        g.transform(ax, ay, bx, by, ox, oy);
        g.lineCap = 'round';
        g.lineJoin = 'round';
        const px = 1 / (scale * Math.hypot(ax, ay));
        glyphPath(g, 'ingwaz', 0, 0, r);
        g.strokeStyle = css(hex('#5c3e34'));
        g.lineWidth = Math.max(r * 0.42, 2.2 * px);
        g.stroke();
        glyphPath(g, 'ingwaz', 0, 0, r);
        g.strokeStyle = RUNE_GOLD;
        g.lineWidth = Math.max(r * 0.2, 1.1 * px);
        g.stroke();
        g.restore();
      },
    });
  }

  /*
   * -- the small nest has no hood: a heaped tuft of moss at the back of its
   * rim, a blossom or two in it and ivy over the edge --
   */
  if (!sp.hood) {
    const a0 = -Math.PI / 2 + 0.25;
    const pads: Array<[V3, number]> = [];
    for (let j = 0; j < 9; j++) {
      const a = a0 + (j / 8 - 0.5) * 1.3, up = Math.sin((j / 8) * Math.PI);
      pads.push([onRing(R - T * (0.2 + 0.4 * R0()), a, H + 0.3 + up * 0.9), 0.75 + 0.35 * up]);
    }
    const leaves: Array<[V3, number, number]> = [[onRing(R + T * 0.5, a0 - 0.5, H - 0.4), 1.9, Math.PI + 0.5], [onRing(R + T * 0.5, a0 + 0.55, H - 0.5), 1.8, Math.PI - 0.4], [onRing(R - T * 0.3, a0, H + 1.6), 1.8, -0.3]];
    const flowers: Array<[V3, number]> = [[onRing(R - T * 0.3, a0 - 0.15, H + 1.5), 1.45], [onRing(R - T * 0.2, a0 + 0.4, H + 1.1), 1.2], [onRing(R - T * 0.2, a0 - 0.5, H + 0.9), 0.8]];
    const mid = onRing(R, a0, H);
    parts.push({ order: (e) => near(e, mid) + 0.02, reach: pads.map(([p]) => [p[0], p[1], p[2] + 2] as V3), draw: clusterDraw(pads, leaves, flowers) });
  }

  /*
   * -- the hood: a rope of two or three withies twisted together up off the
   * back of the rim, over and round into a spiral; under it a vault of woven
   * withies whose two edges come up off the rim either side and draw in
   * toward the rope, so the hood is a shell; its outside buried in moss and
   * ivy, its inside the weave; clumps of moss with a blossom in each along
   * it, tendrils trailing off its front, and lavender bells hung off its
   * edges and the front of its spiral --
   */
  let bellsAt: V3 | undefined;
  const hd = sp.hood;
  if (hd) {
    const N = 30;
    const spine = archPath(sp, hd, () => 0, 1, N);
    const vault = hd.vault, half = hd.side * R;
    const M = Math.round(N * vault);
    const [cy, cz] = hoodMiddle(sp, hd);
    const out = (p: V3): V3 => { const dy = p[1] - cy, dz = p[2] - cz, l = Math.hypot(dy, dz) || 1; return [0, dy / l, dz / l]; };
    // The vault's edges, drawing in a little toward the rope as they go, so it stays broad seen from the front; its ridge bowed out over the rope.
    const edge = (sign: number): V3[] => archPath(sp, hd, (u) => sign * half * (1 - (stage === 2 ? 0.2 : 0.4) * Math.pow(Math.sin(Math.min(1, u / vault) * Math.PI / 2), 1.3)), vault, M).map((p, k) => {
      const o = out(p), drop = 0.9 * (1 - k / M);
      return [p[0], p[1] - o[1] * drop, p[2] - o[2] * drop] as V3;
    });
    const L = edge(-1), Rt = edge(1);
    const ridge = spine.slice(0, M + 1).map((p, k) => { const o = out(p), b = half * 0.3 * (1 - k / M); return [p[0], p[1] + o[1] * b, p[2] + o[2] * b] as V3; });
    const sheet: DenFace[] = [];
    const strip = (A: V3[], B: V3[], side: number): void => {
      for (let k = 0; k < M; k++) {
        const pts = [A[k], A[k + 1], B[k + 1], B[k]];
        const u = sub3(pts[1], pts[0]), v = sub3(pts[3], pts[0]);
        const n0: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        let n: V3 = mul(n0, 1 / (Math.hypot(...n0) || 1));
        // Out of the vault: away from the spiral's middle.
        if (dot(n, out(centre(pts))) < 0) n = mul(n, -1);
        const al = Math.hypot(...u) || 1;
        sheet.push({ pts, n, tone: HOOD, frame: { o: pts[0], a: mul(u, 1 / al), b: v }, crease: 0.12, paint: (g, fill) => hoodWeave(g, fill, al, k, side) });
      }
    };
    strip(L, ridge, -1);
    strip(ridge, Rt, 1);
    // The rope's strands, twisted round its line: each a helix about it, out of step with the next.
    const strands = (stage === 2 ? [0, 1, 2] : [0, 1]).map((i, _j, all) => spine.map((p, k) => {
      const o = out(p), ph = k * 0.95 + (i / all.length) * TAU, rr = hd.thick * 0.42 * (1 - 0.5 * (k / N));
      return [p[0] + Math.cos(ph) * rr, p[1] + o[1] * Math.sin(ph) * rr, p[2] + o[2] * Math.sin(ph) * rr] as V3;
    }));
    // Clumps of moss along the rope and the edges, a blossom in every one.
    const pads: Array<[V3, number]> = [];
    const leaves: Array<[V3, number, number]> = [];
    const flowers: Array<[V3, number]> = [];
    // A clump: cushions of moss, ivy out of it, a blossom if it has one; `out` pushes it out past the edge it sits on, so the canopy is broad.
    const clumpAt = (p: V3, n: number, size: number, flower = true, out = 0): void => {
      const c: V3 = [p[0] + out * size * 0.55, p[1], p[2]];
      for (let j = 0; j < n; j++) pads.push([[c[0] + (R0() - 0.5) * size * 1.6, c[1] + (R0() - 0.5) * size, c[2] + size * 0.4 + R0() * 0.4], (0.55 + R0() * 0.35) * size]);
      for (let j = 0; j < 2 + (out ? 1 : 0); j++) leaves.push([[c[0] + (R0() - 0.5) * size * 2.2 + out * size * 0.4, c[1] + (R0() - 0.5) * size, c[2] + (R0() - 0.3) * size], 1.3 + 0.5 * size, out ? (out > 0 ? -1 : 1) * (0.6 + R0() * 0.8) : (R0() - 0.5) * 3]);
      if (flower) flowers.push([[c[0] + (R0() - 0.5) * size, c[1], c[2] + size * 0.85], 1.0 + 0.25 * size]);
    };
    const clumps = stage === 1 ? [0.2, 0.45, 0.75] : [0.16, 0.34, 0.52, 0.7, 0.88];
    clumps.forEach((u) => clumpAt(spine[Math.round(u * N)], 3, 1.15 + 0.25 * stage));
    // Along each edge of the vault, big clumps, a blossom in every other: seen front on, the hood is one broad canopy of leaves.
    for (const [side, E] of [[-1, L], [1, Rt]] as Array<[number, V3[]]>) {
      (stage === 1 ? [0.25, 0.5, 0.75] : [0.2, 0.4, 0.6, 0.8]).forEach((u, j) => clumpAt(E[Math.round(u * M)], 4, stage === 1 ? 1.5 : 1.8, j % 2 === (side > 0 ? 1 : 0), side));
    }
    const moss = clusterDraw(pads, leaves, flowers);
    /*
     * The vault's outside buried in moss and ivy, so the hood is a living
     * thing and not a scoop of wood: cushions all over it, leaves among them,
     * each laid only where the side it is on faces the eye; under it, seen
     * from below, the weave, and a little moss and ivy hanging.
     */
    const drape: Array<[V3, number, V3]> = [];
    for (const [A, B] of [[L, ridge], [ridge, Rt]]) for (let k = 0; k <= M; k++) {
      for (let j = 0; j < 3; j++) {
        if (R0() > 0.95 + 0.1 * Math.sin(k * 0.9 + j)) continue;
        const v = (j + 0.2 + R0() * 0.6) / 3;
        const p: V3 = [A[k][0] + (B[k][0] - A[k][0]) * v, A[k][1] + (B[k][1] - A[k][1]) * v, A[k][2] + (B[k][2] - A[k][2]) * v];
        const o = out(p), inside = R0() < 0.22, d = inside ? -0.3 : 0.35;
        drape.push([[p[0], p[1] + o[1] * d, p[2] + o[2] * d], (1.1 + R0() * 0.7) * (0.85 + 0.2 * stage) * (inside ? 0.7 : 1), inside ? mul(o, -1) : o]);
      }
    }
    const drapeDraw = (g: Ctx, e: Eye, scale: number, cut: boolean): void => {
      const across = Math.hypot(e.ux, e.uy) * 0.9;
      const shown = drape.filter(([, , n]) => dot(n, e.toward) > 0);
      const ps: Pad[] = shown.map(([p, r, n]) => {
        const [x, y] = proj(e, p);
        return [x, y, r * across, r * across * (0.6 + 0.35 * Math.abs(n[2]))] as Pad;
      });
      if (cut) { g.beginPath(); for (const [x, y, rx, ry] of ps) { g.moveTo(x + rx, y); g.ellipse(x, y, rx, ry, 0, 0, TAU); } g.fill(); return; }
      drawPads(g, ps, DEN_MOSS);
      // Ivy among it: on the outside every few cushions, and hanging off the inside.
      shown.forEach(([p, r, n], i) => {
        const [x, y] = proj(e, p);
        if (n[2] <= -0.2) { if (r > 0.85) leaf(g, x, y + r * across * 0.5, r * across * 1.5, Math.PI + (p[0] % 1) * 0.8, false, false); return; }
        if (i % 3 === 0 && (scale >= 1.5 || i % 6 === 0)) leaf(g, x + r * across * 0.4, y - r * across * 0.2, r * across * 1.7, (i * 1.7) % 2.4 - 1.2, i % 2 === 0, false);
      });
    };
    /*
     * Tendrils trailing off the front of the vault and the spiral: a fine
     * vine hanging and swaying a little off true, ivy leaves along it by
     * turns, ending clear of the cushion and whoever sleeps on it.
     */
    const sleeperTop = sleeperTopOf(stage, zc);
    // The lowest a thing hung off the hood may come over a point: clear of the rim, and over the cushion clear of a sleeper's back.
    // The medium bed's hood is a canopy over the back of the cushion only: its bells hang short off its lip, over the back of it.
    const lowestAt = (p: V3): number => (stage === 1 ? H + 1.2 : Math.hypot(p[0], p[1]) < ri * 0.8 ? Math.max(sleeperTop, H + 2) + 2 : H + 2);
    const bellR = stage === 2 ? 1.3 : 1.0;
    const tendrils: V3[][] = [];
    const tendrilFrom: V3[] = [];
    // And more off each side of the arch, trailing down its flanks.
    for (const E of [L, Rt]) for (const u of stage === 1 ? [0.35, 0.7] : [0.3, 0.55, 0.8]) tendrilFrom.push(E[Math.round(u * M)]);
    const nT = stage === 2 ? 9 : 5;
    for (let j = 0; j < nT; j++) {
      const which = j % 3;
      const src = which === 0 ? spine : which === 1 ? L : Rt;
      const lo = which === 0 ? Math.round(N * 0.45) : Math.round(src.length * 0.5);
      const k = Math.min(src.length - 1, lo + Math.floor(((j / 3 + 0.5 + R0() * 0.5) / Math.ceil(nT / 3)) * (src.length - 1 - lo)));
      tendrilFrom.push(src[k]);
    }
    for (const p0 of tendrilFrom) {
      const len = Math.max(1.2, Math.min(p0[2] - hd.thick * 0.5 - lowestAt(p0), (stage === 2 ? 4 : 2.6) + R0() * (stage === 2 ? 5 : 3)));
      const sway = (R0() - 0.5) * 1.6, pts: V3[] = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        pts.push([p0[0] + Math.sin(u * 2.4) * sway, p0[1] + Math.sin(u * 3.1 + sway) * 0.5, p0[2] - hd.thick * 0.5 - u * len]);
      }
      tendrils.push(pts);
    }
    const drawTendrils = (g: Ctx, e: Eye, scale: number, cut: boolean): void => {
      const across = Math.hypot(e.ux, e.uy);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const [ti, t] of tendrils.entries()) {
        const scr = t.map((q) => proj(e, q));
        g.beginPath();
        scr.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokeStyle = cut ? '#000' : LEAF.line;
        g.lineWidth = Math.max(0.55, 0.32 * across);
        g.stroke();
        for (let i = 2; i < scr.length; i += scale >= 1.5 ? 2 : 3) {
          const [x, y] = scr[i], side = (i + ti) % 2 ? 1 : -1;
          leaf(g, x + side * 0.6 * across, y, (1.15 + 0.15 * stage) * across * (1 - i / 14), Math.PI + side * 0.9, i % 4 === 0, cut);
        }
      }
    };
    /*
     * The bells: along the vault's two front edges at different places on
     * each, so they never bunch, and along the front half of the spiral;
     * their drops long and short by turns. Over the cushion none hangs lower
     * than a sleeper's back and a little more, so it never covers whoever
     * sleeps there or the heart of the flower.
     */
    const bells: Array<{ at: V3; r: number; drop: number }> = [];
    const hangFrom = (p: V3, j: number): void => {
      const lowest = lowestAt(p);
      const r = bellR + R0() * 0.2;
      const want = j % 2 ? 0.6 + R0() * 0.8 : (stage === 2 ? 3.2 : 1.4) + R0() * 1.4;
      const room = p[2] - hd.thick * 0.8 - lowest - r * 2.1;
      bells.push({ at: [p[0], p[1], p[2] - hd.thick * 0.8], r, drop: Math.max(0.5, Math.min(room, want)) });
    };
    // Where a bell may hang at all: with room under it for the least drop, clear of what it must not cover.
    const fits = (p: V3): boolean => p[2] - hd.thick * 0.8 - lowestAt(p) - bellR * 2.1 >= 0.4;
    if (sp.bells) {
      const onEdges = Math.round(sp.bells * 0.55);
      const perEdge = Math.ceil(onEdges / 2);
      const edgeAt = (E: V3[]): V3[] => E.slice(Math.round(M * 0.4)).filter(fits);
      const left = edgeAt(L), right = edgeAt(Rt);
      for (let j = 0; j < onEdges; j++) {
        const isRight = j % 2 === 1, n = Math.floor(j / 2);
        // Spread over the front of each edge, the right edge's half a step on from the left's, so no two hang together.
        const E = isRight ? right : left;
        if (!E.length) continue;
        hangFrom(E[Math.min(E.length - 1, Math.floor(((n + (isRight ? 0.75 : 0.25)) / perEdge) * E.length))], j);
      }
      const rest = sp.bells - bells.length;
      const front = spine.slice(Math.round(N * 0.4), N - 1).filter(fits);
      for (let j = 0; j < rest && front.length; j++) hangFrom(front[Math.min(front.length - 1, Math.floor(((j + 0.5) / rest) * front.length))], j + 1);
    }
    const base = spine[0];
    const order = (e: Eye): number => near(e, [base[0], base[1], 0]) + 0.03;
    // A bell behind the hood or in front of it, as the eye has it: by which side of the spiral's plane it hangs, and which way the vault opens.
    const mid = spine[Math.round(N * 0.4)];
    const inFront = (e: Eye, b: { at: V3 }): boolean => near(e, [b.at[0], b.at[1], 0]) > near(e, [b.at[0] * 0.3, mid[1], 0]) + (Math.abs(b.at[0]) > half * 0.5 ? 0 : 0.5);
    const hung = (b: { at: V3; r: number; drop: number }) => ({ at: [b.at[0], b.at[1], b.at[2] - b.drop - b.r * 1.45] as V3, r: b.r, top: b.at, drop: b.drop });
    const drawBells = (g: Ctx, e: Eye, cut: boolean, front: boolean): void => {
      for (const b of bells) {
        if (inFront(e, b) !== front) continue;
        const [x, y] = proj(e, b.at);
        bell(g, x, y, b.r * HEIGHT_SCALE * 1.9, b.drop * HEIGHT_SCALE, cut);
      }
    };
    parts.push({ order: (e) => order(e) - 0.0005, reach: [], bells: (e) => bells.filter((b) => !inFront(e, b)).map(hung), draw: (g, e, _s, cut) => drawBells(g, e, cut, false) });
    parts.push({
      order,
      solid: true,
      reach: [...spine, ...L, ...Rt].map((p) => [p[0], p[1], p[2] + hd.thick + 2] as V3)
        .concat(bells.map((b) => [b.at[0], b.at[1], b.at[2] - b.drop - b.r * 2] as V3), tendrils.map((t) => t[t.length - 1])),
      draw: (g, e, scale, cut) => {
        const fine = scale >= 2;
        // The outside foliage, the inside its weave: a face is painted only seen from under.
        const faced = sheet.map((f) => (dot(f.n, e.toward) < 0 ? { ...f, n: mul(f.n, -1), tone: HOOD_UNDER } : { ...f, paint: undefined }));
        if (!cut) inkFaces(g, e, faced);
        fillFaces(g, e, faced, cut);
        drapeDraw(g, e, scale, cut);
        // Its edges, and the rope over it: a core and its strands twisted round it, the far ones first.
        // The edges' own withies thin and mossy, so front on the hood is a canopy and not posts.
        for (const E of [L, Rt]) tube(g, e, E, hd.thick * 0.2, hd.thick * 0.15, HOOD, cut, false);
        const seenStrands = strands.map((st) => ({ st, d: near(e, centre(st)) })).sort((x, y) => x.d - y.d).map((x) => x.st);
        tube(g, e, spine, hd.thick * 0.72, hd.thick * 0.36, VINE, cut, fine);
        for (const st of seenStrands) tube(g, e, st, hd.thick * 0.42, hd.thick * 0.2, VINE_STRAND, cut, fine);
        moss(g, e, scale, cut);
        drawTendrils(g, e, scale, cut);
      },
    });
    if (bells.length) bellsAt = mul(bells.map((b) => hung(b).at).reduce<V3>((m2, q) => add(m2, q), [0, 0, 0]), 1 / bells.length);
    parts.push({ order: (e) => order(e) + 0.0005, reach: [], bells: (e) => bells.filter((b) => inFront(e, b)).map(hung), draw: (g, e, _s, cut) => drawBells(g, e, cut, true) });
  }

  /* -- what grows at its foot: a few tufts of grass and a leaf or two -- */
  for (let i = 0; i < 4 + stage * 2; i++) {
    const a = phase + (i / (4 + stage * 2)) * TAU + R0() * 0.6, d = R * (0.82 + R0() * 0.18);
    const at: V3 = [Math.cos(a) * d, Math.sin(a) * d, 0];
    const s0 = sp.seed * 13 + i;
    parts.push({
      order: (e) => (near(e, at) > near(e, axis) ? 1e8 : -2e9),
      reach: [[at[0], at[1], 3]],
      draw: (g, e, _s, cut) => {
        if (cut) return;
        const [x, y] = proj(e, at);
        grassTuft(g, x, y, s0, 0.42 + 0.1 * stage);
      },
    });
  }

  const model: Model = { spec: sp, basket, lip, parts, zc, ri, foot: R * 0.9, bellsAt };
  models.set(stage, model);
  return model;
}

/* ---- the sleeper -------------------------------------------------------------- */

/** A colour as CSS gives it: '#rrggbb' or 'rgb(r, g, b)'. */
const rgbOf = (c: string): RGB => {
  if (c.startsWith('#')) return hex(c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c);
  const n = c.match(/[\d.]+/g)?.map(Number) ?? [200, 180, 160];
  return [n[0] ?? 200, n[1] ?? 180, n[2] ?? 160];
};

/** A low dome of faces: rings drawing in to a small top, for a body or a head curled up. */
function dome(c: V3, rx: number, ry: number, h: number, sides: number, tone: Tone, turn = 0): DenFace[] {
  const rings: Array<[number, number]> = [[1, 0], [0.97, 0.38], [0.8, 0.74], [0.45, 0.97], [0.12, 1]];
  const faces: DenFace[] = [];
  const P = (k: number, i: number): V3 => {
    const a = turn + (i / sides) * TAU;
    return [c[0] + rx * rings[k][0] * Math.cos(a), c[1] + ry * rings[k][0] * Math.sin(a), c[2] + h * rings[k][1]];
  };
  for (let k = 0; k + 1 < rings.length; k++) {
    for (let i = 0; i < sides; i++) {
      const pts = [P(k, i), P(k, i + 1), P(k + 1, i + 1), P(k + 1, i)];
      const am = turn + ((i + 0.5) / sides) * TAU;
      const dr = (rings[k + 1][0] - rings[k][0]), dz = (rings[k + 1][1] - rings[k][1]) * h / Math.max(rx, ry);
      const l = Math.hypot(dr, dz) || 1;
      faces.push({ pts, n: [(dz / l) * Math.cos(am), (dz / l) * Math.sin(am), -dr / l], tone, crease: 0.12 });
    }
  }
  faces.push({ pts: Array.from({ length: sides }, (_, i) => P(rings.length - 1, i)), n: [0, 0, 1], tone, crease: 0.12 });
  return faces;
}

interface SleeperModel {
  body: DenFace[];
  bodyC: V3;
  head: DenFace[];
  headAt: V3;
  headR: number;
  /** Which way its face looks, in the model. */
  looks: V3;
  tail: V3[];
  tailR: number;
  coat: Tone;
  mark: Tone;
  top: number;
}

function sleeperOf(stage: 0 | 1 | 2, colors: [string, string]): SleeperModel {
  const m = modelOf(stage);
  const coatRGB = rgbOf(colors[0]), markRGB = rgbOf(colors[1]);
  // Its coat a step paler and softer, as the island's pastels are, its shade a cool mauve.
  const coat: Tone = { lit: mix(coatRGB, [255, 248, 240], 0.18), shade: mix(coatRGB, hex('#6d5a7a'), 0.42) };
  const mark: Tone = { lit: mix(markRGB, [255, 248, 240], 0.15), shade: mix(markRGB, hex('#6d5a7a'), 0.42) };
  // A little fuller in the small nest, so a sleeper there still rises over the rim at the furthest zoom.
  const rb = m.ri * (stage === 0 ? 0.66 : 0.5);
  const z0 = m.zc + 0.35;
  const bodyC: V3 = [rb * 0.12, -rb * 0.1, z0];
  const body = dome(bodyC, rb, rb * 0.86, rb * (stage === 0 ? 0.78 : 0.62), 12, coat, 0.2);
  // Its head tucked down on the front left of its curl, resting on its tail.
  const ha = Math.PI * 0.68;
  const headR = rb * 0.5;
  const headAt: V3 = [bodyC[0] + Math.cos(ha) * rb * 0.78, bodyC[1] + Math.sin(ha) * rb * 0.82, z0 + 0.05];
  const head = dome(headAt, headR, headR * 0.92, headR * 0.95, 10, coat, 0.1);
  // The tail round the front of it from its right, to its tip under the chin.
  const tail: V3[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.05 + (i / 10) * Math.PI * 0.62;
    tail.push([bodyC[0] + Math.cos(a) * rb * 1.02, bodyC[1] + Math.sin(a) * rb * 0.98, z0 + 0.35 * rb * (1 - i / 10) + 0.25]);
  }
  return { body, bodyC, head, headAt, headR, looks: [Math.cos(ha + 0.5), Math.sin(ha + 0.5), 0], tail, tailR: rb * 0.3, coat, mark, top: z0 + headR * 2.2 };
}

/** A sleeper's shape alone, for taking it out of the bells' light behind it. */
function sleeperCut(g: Ctx, e: Eye, s: SleeperModel): void {
  g.fillStyle = '#000';
  for (const f of [...s.body, ...s.head]) { polyPath(g, e, f.pts); g.fill(); }
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  g.lineWidth = s.tailR * 2 * Math.hypot(e.ux, e.uy) * 1.1;
  g.beginPath();
  s.tail.forEach((p, i) => { const [x, y] = proj(e, p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.stroke();
}

/** Lay a sleeper, curled, inked: its body and tail and head in the order the eye has them, its ears up, its eye shut. */
function drawSleeper(g: Ctx, e: Eye, s: SleeperModel, fine: boolean): void {
  const across = Math.hypot(e.ux, e.uy);
  const all = [...s.body, ...s.head];
  inkFaces(g, e, all, INK);
  const tailNear = near(e, s.tail[6]) > near(e, s.bodyC);
  const drawTail = (): void => {
    const scr = s.tail.map((p) => proj(e, p));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const pass = (w: number, colour: string, dy = 0, from = 0): void => {
      g.strokeStyle = colour;
      g.lineWidth = w;
      g.beginPath();
      scr.slice(from).forEach(([x, y], i) => (i ? g.lineTo(x, y + dy) : g.moveTo(x, y + dy)));
      g.stroke();
    };
    const w = s.tailR * 2 * across * 1.1;
    pass(w + INK * 2, css(INK_COLOUR));
    pass(w, css(faceColour(s.coat, 0.8)));
    pass(w * 0.55, css(faceColour(s.coat, 1)), -w * 0.18);
    // Its tip in its markings.
    pass(w * 1.08, css(faceColour(s.mark, 0.85)), 0, 7);
    pass(w * 0.5, css(faceColour(s.mark, 1)), -w * 0.18, 7);
  };
  if (!tailNear) drawTail();
  const headNear = near(e, s.headAt) > near(e, s.bodyC);
  if (!headNear) { fillFaces(g, e, s.head, false); ears(); }
  fillFaces(g, e, s.body, false);
  // A blaze of its markings down its back.
  {
    const top = s.body[s.body.length - 1];
    polyPath(g, e, top.pts.map((p) => [p[0], p[1], p[2] + 0.02] as V3));
    g.fillStyle = css(faceColour(s.mark, 0.95), 0.75);
    g.fill();
  }
  if (tailNear) drawTail();
  if (headNear) { fillFaces(g, e, s.head, false); ears(); }
  face();

  function ears(): void {
    // Two soft ears up off the crown of its head, laid back.
    const [hx, hy] = proj(e, [s.headAt[0], s.headAt[1], s.headAt[2] + s.headR * 0.85]);
    const r = s.headR * across * 1.05;
    for (const side of [-1, 1]) {
      const bx = hx + side * r * 0.42, by = hy;
      g.beginPath();
      g.moveTo(bx - r * 0.3, by + r * 0.05);
      g.quadraticCurveTo(bx + side * r * 0.2, by - r * 0.95, bx + side * r * 0.42, by - r * 0.62);
      g.quadraticCurveTo(bx + side * r * 0.35, by - r * 0.1, bx + r * 0.3, by + r * 0.08);
      g.closePath();
      g.fillStyle = css(faceColour(s.coat, side < 0 ? 1 : 0.82));
      g.strokeStyle = css(INK_COLOUR);
      g.lineWidth = INK * 1.4;
      g.stroke();
      g.fill();
      if (fine) {
        g.beginPath();
        g.moveTo(bx - r * 0.1, by - r * 0.05);
        g.quadraticCurveTo(bx + side * r * 0.18, by - r * 0.6, bx + side * r * 0.3, by - r * 0.45);
        g.strokeStyle = css(faceColour(s.mark, 0.9));
        g.lineWidth = r * 0.16;
        g.stroke();
      }
    }
  }
  function face(): void {
    // Its eye shut, a soft arc, and a blush under it -- on the side of its head the eye sees, if any.
    const sees = dot(s.looks, e.toward) / Math.hypot(...e.toward);
    if (sees < -0.15) return;
    const out = add(s.headAt, [s.looks[0] * s.headR * 0.62, s.looks[1] * s.headR * 0.62, s.headR * 0.52]);
    const [x, y] = proj(e, out);
    const r = s.headR * across * 0.36;
    g.strokeStyle = css(INK_COLOUR);
    g.lineWidth = Math.max(0.6, r * 0.32);
    g.lineCap = 'round';
    g.beginPath();
    g.arc(x, y - r * 0.2, r, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
    if (fine) {
      g.fillStyle = 'rgba(240, 150, 170, 0.45)';
      g.beginPath();
      g.ellipse(x + r * 0.2, y + r * 0.9, r * 0.6, r * 0.32, 0, 0, TAU);
      g.fill();
    }
  }
}

/* ---- baking ------------------------------------------------------------------ */

/** A picture and where it goes, in pixels at zoom one from the footprint's middle. */
interface Sheet { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number }

interface Bake {
  scale: number;
  /** All of it, empty; and its two halves round a sleeper. */
  whole: Sheet;
  back: Sheet;
  front: Sheet;
  /** Its bells' shapes, to take the night off with, and where each is for its soft light round it. */
  /** Its bells' light after dark, made the first time it is wanted (`BellLight`); null for a bed with no bells. */
  night: () => BellLight | null;
  /** Whether `night` has been made yet. */
  lit: () => boolean;
  bounds: [number, number, number, number];
  hit: [number, number, number, number];
  area: number;
}

/**
 * A bed's bells after dark: their own warm light, each a soft blob round its
 * bell less whatever of the bed is laid in front of it, added in the bed's
 * place (`drawDenLive`); and again with a sleeper on the cushion hiding what
 * hangs behind it.
 */
interface BellLight {
  glow: Sheet;
  glowSlept: Sheet;
}

interface SleeperBake { sheet: Sheet; /** Where it breathes from, and where its `z` rises from. */ foot: [number, number]; head: [number, number]; area: number }

/** Pixels of bakes kept before the least lately drawn is let go. */
const BUDGET = 8e6;
class Kept<B extends { area: number }> {
  private kept = new Map<string, B>();
  private area = 0;
  has(key: string): boolean {
    return this.kept.has(key);
  }
  get(key: string, make: () => B): B {
    let b = this.kept.get(key);
    if (b) { this.kept.delete(key); this.kept.set(key, b); return b; }
    b = make();
    this.kept.set(key, b);
    this.area += b.area;
    for (const [k, old] of this.kept) {
      if (this.area <= BUDGET || k === key) break;
      this.kept.delete(k);
      this.area -= old.area;
    }
    return b;
  }
}
const bakes = new Kept<Bake>();
const sleepers = new Kept<SleeperBake>();

/** A piece's turn, as `pieceView` gives it. */
export interface DenView { ux: number; uy: number; vx: number; vy: number }
const viewKey = (v: DenView): string => `${v.ux.toFixed(3)},${v.uy.toFixed(3)},${v.vx.toFixed(3)},${v.vy.toFixed(3)}`;

function boxOf(e: Eye, pts: readonly V3[], pad: number): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    const [x, y] = proj(e, p);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
}

function sheetOf(box: readonly number[], scale: number): [Sheet, Ctx] {
  const [x0, y0, x1, y1] = box;
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  return [{ canvas, x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, g];
}

function bake(stage: 0 | 1 | 2, view: DenView, scale: number): Bake {
  const m = modelOf(stage);
  const e = eyeOfView(view);
  const sp = m.spec;
  const reach = m.parts.flatMap((p) => p.reach);
  const bounds = boxOf(e, reach, 4);
  const hit = boxOf(e, m.parts.filter((p) => p.solid).flatMap((p) => p.reach.map((q) => [q[0], q[1], Math.max(0, q[2])] as V3)), 1);
  // Clicked by what grows on its rim too, the small nest's tuft and blossoms: as high as anything of it is drawn.
  hit[1] = Math.min(hit[1], bounds[1] + 4);
  const slot = near(e, [0, 0, 0]);
  const order = m.parts.map((p) => ({ p, o: p.order(e) })).sort((a, b) => a.o - b.o);
  const before = order.filter((x) => x.o < slot).map((x) => x.p), after = order.filter((x) => x.o >= slot).map((x) => x.p);
  // Each sheet only as big as what is laid on it: the near half of a bed is mostly empty, and every pixel of a sheet is blitted every frame.
  const ground = Array.from({ length: 12 }, (_, i) => onRing(m.foot * 1.3, (i / 12) * TAU, 0));
  const backBox = boxOf(e, [...before.flatMap((p) => p.reach), ...ground], 4 + stage);
  const frontBox = after.length ? boxOf(e, after.flatMap((p) => p.reach), 4) : [0, 0, 1, 1] as [number, number, number, number];
  const [back, gb] = sheetOf(backBox, scale);
  // Its shade on the ground, thrown toward the bottom right of the screen as every piece's is, soft.
  for (const [k, a] of [[1.18, 0.05], [1.08, 0.07], [1, 0.08]] as Array<[number, number]>) {
    polyPath(gb, e, Array.from({ length: 20 }, (_, i) => onRing(m.foot * k * 1.08, (i / 20) * TAU, 0)));
    gb.save();
    gb.translate(2.5 + stage, 1.2 + stage * 0.5);
    gb.fillStyle = `rgba(44, 74, 78, ${a})`;
    gb.fill();
    gb.restore();
  }
  for (const p of before) p.draw(gb, e, scale, false);
  const [front, gf] = sheetOf(frontBox, scale);
  for (const p of after) p.draw(gf, e, scale, false);
  const [whole, gw] = sheetOf(bounds, scale);
  gw.setTransform(1, 0, 0, 1, 0, 0);
  for (const sh of [back, front]) gw.drawImage(sh.canvas, (sh.x - bounds[0]) * scale, (sh.y - bounds[1]) * scale);
  /*
   * The bells' shapes: each bell's glow where it hangs, and everything laid
   * after it taken out of that, so a bell behind the withy or the rim is lit
   * only where it is seen.
   */
  // Made only once it is dark enough to want them, and kept with the bake.
  let lit: BellLight | null | undefined;
  const night = (): BellLight | null => {
  if (lit !== undefined) return lit;
  lit = null;
  let glow: Sheet | null = null, glowSlept: Sheet | null = null;
  if (sp.bells) {
    // Two of them: empty, and with a sleeper on the cushion, which hides what hangs behind it.
    // Tight round each bell, twice its own size: the bells are the brightest thing on the bed.
    const glowR = (r: number): number => r * HEIGHT_SCALE * 1.15;
    let maskBox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of m.parts) for (const b of p.bells?.(e) ?? []) {
      const [x, ty] = proj(e, b.top), y = ty + b.drop * HEIGHT_SCALE + b.r * HEIGHT_SCALE * 1.9 * 0.9, r = glowR(b.r) + 1;
      maskBox = [Math.min(maskBox[0], Math.floor(x - r)), Math.min(maskBox[1], Math.floor(Math.min(y - r, ty - 1))), Math.max(maskBox[2], Math.ceil(x + r)), Math.max(maskBox[3], Math.ceil(y + r))];
    }
    const [mk, gm] = sheetOf(maskBox, scale);
    const [ms, gs] = sheetOf(maskBox, scale);
    const curl = sleeperOf(stage, ['#000000', '#000000']);
    let any = false, slept = false;
    for (const { p, o } of order) {
      if (!slept && o >= slot) {
        slept = true;
        gs.globalCompositeOperation = 'destination-out';
        sleeperCut(gs, e, curl);
      }
      const hung = p.bells?.(e);
      if (hung) {
        for (const g of [gm, gs]) {
          g.globalCompositeOperation = 'source-over';
          for (const b of hung) {
            /*
             * The light in the bell, in colour: warm at its mouth, where it is
             * seen lit from inside, and a soft lavender-warm bloom just round
             * that -- the cap left as it is painted, so a bell after dark is
             * still a lavender cap over a lit mouth, never one flat patch.
             */
            const [tx, ty] = proj(e, b.top);
            const h = b.r * HEIGHT_SCALE * 1.9;
            const mx = tx, my = ty + b.drop * HEIGHT_SCALE + h * 0.9;
            const r = glowR(b.r);
            const gr = g.createRadialGradient(mx, my, 0, mx, my, r);
            gr.addColorStop(0, 'rgba(255, 186, 110, 0.7)');
            gr.addColorStop(0.22, 'rgba(240, 150, 150, 0.42)');
            gr.addColorStop(0.55, 'rgba(196, 140, 210, 0.22)');
            gr.addColorStop(1, 'rgba(160, 120, 200, 0)');
            g.fillStyle = gr;
            g.beginPath();
            g.ellipse(mx, my, r, r * 0.8, 0, 0, TAU);
            g.fill();
          }
        }
        any = true;
        continue;
      }
      if (!any) continue;
      for (const g of [gm, gs]) {
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = '#000';
        g.strokeStyle = '#000';
        p.draw(g, e, scale, true);
      }
    }
    if (!slept) { gs.globalCompositeOperation = 'destination-out'; sleeperCut(gs, e, curl); }
    gm.globalCompositeOperation = gs.globalCompositeOperation = 'source-over';
    if (any && glow === null) { glow = mk; glowSlept = ms; }
  }
  if (glow && glowSlept) lit = { glow, glowSlept };
  return lit;
  };
  const px = (s: Sheet): number => s.canvas.width * s.canvas.height;
  // Its bells' pictures, when they are made, are a third again the bake's own pixels at most: counted in from the first.
  return { scale, whole, back, front, night, lit: () => lit !== undefined, bounds, hit, area: Math.round((px(whole) + px(back) + px(front)) * (sp.bells ? 1.35 : 1)) };
}

/*
 * Bakes made ahead, while the browser is idle: a bed seen from one way is
 * baked for the turns either side of it too, and for the next scale up when
 * the zoom is nearly there, so turning the camera or zooming in finds them
 * made rather than making them in the frame -- a large bed's first bake at
 * the biggest scale is a frame's worth of time on its own.
 */
const ahead: Array<() => void> = [];
const queued = new Set<string>();
let idling = false;
function idle(): void {
  if (idling || !ahead.length) return;
  idling = true;
  const run = (left: () => number, late: boolean): void => {
    idling = false;
    // While there is time for one; and one regardless when the browser has had no idle moment for a while, as a busy game may not.
    if (late && ahead.length) ahead.shift()?.();
    while (ahead.length && left() > 10) ahead.shift()?.();
    if (ahead.length) idle();
  };
  const w = globalThis as unknown as { requestIdleCallback?: (f: (d: { timeRemaining(): number; didTimeout: boolean }) => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback((d) => run(() => d.timeRemaining(), d.didTimeout), { timeout: 120 });
  else setTimeout(() => { const t0 = performance.now(); run(() => 30 - (performance.now() - t0), true); }, 60);
}

/**
 * Bake a bed ahead of its being drawn, for the views it will be seen by next
 * (`pieceView` for the camera's turns either side) and, when the zoom is
 * within a sixth of the next bake step, that step too: done when the browser
 * is idle, never in a frame. A sleeper in it is baked ahead with it.
 */
export function prewarmDen(kind: string, views: readonly DenView[], zoom: number, look: DenLook = {}): void {
  const stage = denStage(kind) ?? 0;
  const scale = scaleFor(zoom), next = BAKE_STEPS.find((z) => z > scale);
  const wants: Array<[DenView, number]> = views.map((v) => [v, scale]);
  if (next !== undefined && zoom > scale - (scale - (BAKE_STEPS[BAKE_STEPS.indexOf(scale) - 1] ?? 0)) / 6 && views.length) wants.push([views[0], next]);
  for (const [v, sc] of wants) {
    const key = `${stage}|${viewKey(v)}|${sc}`;
    if (!bakes.has(key) && !queued.has(key)) {
      queued.add(key);
      ahead.push(() => { queued.delete(key); baked(stage, v, sc); });
    }
    const sl = look.sleeper;
    if (sl) {
      const sk = `${key}|${sl.colors.join('|')}|${sl.species ?? ''}|${sl.stage ?? stage}`;
      if (!sleepers.has(sk) && !queued.has(sk)) {
        queued.add(sk);
        ahead.push(() => { queued.delete(sk); sleeperBaked(stage, v, sc, sl.colors, sl.species, sl.stage ?? stage); });
      }
    }
  }
  idle();
}

/** A bake's bells after dark, made when the browser is next idle the first time they are wanted, as the bakes themselves are. */
const pending = new WeakSet<Bake>();
function bellsOf(b: Bake): BellLight | null {
  if (sync || b.lit()) return b.night();
  if (!pending.has(b)) {
    pending.add(b);
    ahead.unshift(() => { b.night(); });
    idle();
  }
  return null;
}

/** Whether every bake is made the moment it is wanted, as a harness or a test wants: the island never asks for it. */
let sync = false;
export const denSync = (on: boolean): void => { sync = on; };

/**
 * The bake to draw a bed by this frame: the one at its scale if it is made;
 * else, while that one is made when the browser is next idle, the nearest
 * smaller one of the same view drawn up to size for a moment, or failing any,
 * the smallest, made now -- so a first look at a bed close up costs a frame a
 * small bake and never a big one.
 */
function soon(stage: 0 | 1 | 2, view: DenView, zoom: number): Bake {
  const scale = scaleFor(zoom), key = `${stage}|${viewKey(view)}|${scale}`;
  if (sync || bakes.has(key) || scale === BAKE_STEPS[0]) return baked(stage, view, zoom);
  if (!queued.has(key)) {
    queued.add(key);
    // Ahead of anything only made in case: this is wanted now.
    ahead.unshift(() => { queued.delete(key); baked(stage, view, scale); });
    idle();
  }
  for (let i = BAKE_STEPS.indexOf(scale) - 1; i > 0; i--) if (bakes.has(`${stage}|${viewKey(view)}|${BAKE_STEPS[i]}`)) return baked(stage, view, BAKE_STEPS[i]);
  return baked(stage, view, BAKE_STEPS[0]);
}

/**
 * The sleeper to draw this frame: its own model if that is baked, else, while
 * it is baked when the browser is next idle, a curl in its colours, which is
 * a twentieth of the work -- so a wildermon going to bed never costs a frame.
 */
function sleeperSoon(stage: 0 | 1 | 2, view: DenView, zoom: number, sl: NonNullable<DenLook['sleeper']>): SleeperBake {
  const scale = scaleFor(zoom), its = sl.stage ?? stage;
  const key = `${stage}|${viewKey(view)}|${scale}|${sl.colors[0]}|${sl.colors[1]}|${sl.species ?? ''}|${its}`;
  if (sync || !sl.species || sleepers.has(key)) return sleeperBaked(stage, view, zoom, sl.colors, sl.species, its);
  if (!queued.has(key)) {
    queued.add(key);
    ahead.unshift(() => { queued.delete(key); sleeperBaked(stage, view, scale, sl.colors, sl.species, its); });
    idle();
  }
  return sleeperBaked(stage, view, zoom, sl.colors);
}

function baked(stage: 0 | 1 | 2, view: DenView, zoom: number): Bake {
  const scale = scaleFor(zoom);
  return bakes.get(`${stage}|${viewKey(view)}|${scale}`, () => bake(stage, view, scale));
}

function sleeperBaked(stage: 0 | 1 | 2, view: DenView, zoom: number, colors: [string, string], species?: string, its: number = stage): SleeperBake {
  const scale = scaleFor(zoom);
  return sleepers.get(`${stage}|${viewKey(view)}|${scale}|${colors[0]}|${colors[1]}|${species ?? ''}|${its}`, () => {
    const e = eyeOfView(view);
    const kind = species ? (its > 0 ? WILDERMON_STAGES[species]?.[its - 1] : undefined) ?? WILDERMON[species] : undefined;
    // Kept under the name its pictures are kept under at that stage (\`modelAt\` in wildermon.ts): a later stage is its own body.
    if (species && kind) return modelSleeper(stage, e, scale, its > 0 && WILDERMON_STAGES[species]?.[its - 1] ? `${species}@${its}` : species, kind, colors);
    const s = sleeperOf(stage, colors);
    const pts = [...s.body, ...s.head].flatMap((f) => f.pts).concat(s.tail, [[s.headAt[0], s.headAt[1], s.top]]);
    const box = boxOf(e, pts, 3);
    const [sheet, g] = sheetOf(box, scale);
    drawSleeper(g, e, s, scale >= 2);
    const foot = proj(e, [0, 0, modelOf(stage).zc]);
    const head = proj(e, [s.headAt[0], s.headAt[1], s.top]);
    return { sheet, foot, head, area: sheet.canvas.width * sheet.canvas.height };
  });
}

/** How far the gold heart of a bed's flower reaches from its middle. */
const heartOf = (m: { ri: number; spec: Spec }): number => m.ri * (m.spec.outer <= 6 ? 0.34 : 0.28);

/** Which way a sleeper lies in its bed, in the bed's own frame: its head toward the front left. */
const LIES = 2.55;
/** How far into its cushion a sleeper settles, as a share of how tall it stands: its legs, folded under it. */
const SETTLES = 0.44;
/** How much lower than it stands it lies, its weight let down. */
const SQUAT = 0.86;
/** How high a sleeper may come over its bed's floor, in units: what the bells and tendrils hang clear of (\`lowestAt\`), and what no sleeper rises past. */
const sleeperTopOf = (stage: number, zc: number): number => zc + (stage === 2 ? 7.5 : 5);

/** The share of its cushion's width a sleeper is drawn up to fill, at the least. */
const FILLS = 0.75;
/** What a sleeper does not take to bed: the gear of its work (`kitOf`'s pieces, by name). */
const GEAR = /^(harness|bags|caparison|pennant|bell|pole|yoke|ban|basket|strap|staff|staffUp|hang|sprigHeld|sprigBerries|hod|trowel|club|quarry|rod|tool|held|pack|banners|lantern|item|sword|axe|tree|pail|saddle|pan|bellows|lamp|chain|site|stakes)(\d+|[LR])?$/;
/** And what reaches out from its body, which it is not sized by: wings, a tail, a cape, plumes. */
const REACHES = /^(wing|tail|cape|plume|plumes|tent|feel|feelers|strands|antlers|horns?)/;
/** How far its head drops toward the cushion, nought (up) to one (down at the ground), and its eyes shut. */
const NODS = 0.7;

/**
 * The wildermon itself asleep in a bed, drawn as its own model (`beasts.ts`):
 * its own head, ears, horns, mane and tail, its own coat and markings, turned
 * to lie along the bed whichever way the bed is seen, its eyes shut and its
 * head dropped, settled down into the cushion so its legs are folded out of
 * sight, a soft shade on the petals round it. Drawn at its own size, and
 * smaller only where a bigger one than the bed is meant for is put in it.
 */
function modelSleeper(stage: 0 | 1 | 2, e: Eye, scale: number, key: string, kind: Kind, colors: [string, string], bare = false): SleeperBake {
  const m = modelOf(stage);
  // Its front along the bed's own LIES on the screen, as a body's facing counts it (\`viewOf\`: nought at the viewer, a step an eighth to screen right).
  const dx = Math.cos(LIES) * e.ux + Math.sin(LIES) * e.vx, dy = Math.cos(LIES) * e.uy + Math.sin(LIES) * e.vy;
  const SX = HALF_W / UNITS_PER_TILE, SY = HALF_H / UNITS_PER_TILE;
  const f0 = (dx / SX + dy / SY) / 2, f1 = (dy / SY - dx / SX) / 2;
  const toward = ((Math.PI / 4 - Math.atan2(f1, f0)) * 4) / Math.PI;
  // Seen side on, as a sleeping thing lies along its bed: its head to whichever side of the screen the bed's own way for it is.
  const facing = (((toward % 8) + 8) % 8) < 4 ? 2 : 6;
  const lod = scale < 1.5 ? 0 : 1;
  // Asleep without its working gear: no harness, pack, tool or load.
  const kit = kitOf(key, kind, lod).filter((p) => !GEAR.test(p.key));
  const a: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: NODS, blink: true, breath: 0.5, fleece: 1, seed: 0.3 };
  const ext = extentOf(kind, kit, facing, a);
  // Sized by its body, not what reaches out from it: wings spread, a tail, a cape.
  const core = extentOf(kind, kit.filter((p) => !REACHES.test(p.key)), facing, a);
  const size = kind.size ?? 1;
  const tall = (Math.max(0, core.y1) - core.y0) * size, wide = Math.max(1, (core.x1 - core.x0) * size);
  // As big as it is, and never past the cushion it lies on; a small one drawn up to fill a little over half of it.
  const room = 2 * m.ri * Math.hypot(e.ux, e.uy) * 1.05;
  // Drawn up by the larger of how wide and how tall it is, so a narrow tall kind is not drawn up into a tower.
  const big = Math.max(wide, tall);
  const [cx, cy] = proj(e, [0, 0, m.zc + 0.4]);
  // A body taller than it is long lies lower and longer still, slumped, so an upright kind is not sat up in bed.
  const slump = Math.max(0, Math.min(1, (tall / wide - 0.8) / 0.8));
  const sq = SQUAT - 0.24 * slump, len = 1.04 + 0.3 * slump;
  // A tall body settles its legs down into the cushion; a flat one (a slug, a shell) lies on it as it is.
  const settles = sq * SETTLES * Math.max(0, Math.min(1, (tall / wide - 0.3) / 0.4));
  // And never so big its top rises past what hangs over the cushion (\`sleeperTopOf\`): it lies under the bells.
  const over = (sleeperTopOf(stage, m.zc) - m.zc - 0.4) * HEIGHT_SCALE - 3;
  const rises = Math.max(1e-3, -ext.y0 * size * sq - tall * settles);
  const k = Math.min(room / (wide * len), over / rises, Math.max(1, (room * FILLS) / (big * len)));
  const sink = tall * k * settles;
  const box: [number, number, number, number] = [Math.floor(cx + (ext.x0 * size * len - 3) * k), Math.floor(cy + sink + (ext.y0 * size - 3) * k), Math.ceil(cx + (ext.x1 * size * len + 3) * k), Math.ceil(cy + 3)];
  const [sheet, g] = sheetOf(box, scale);
  // The dip it lies in: the heart of the flower pressed down under it, and a soft shade on the petals round it.
  const rx = Math.max(wide * k * 0.55, heartOf(m) * Math.hypot(e.ux, e.uy) * 1.5), ry = rx * 0.45;
  if (!bare) {
  g.fillStyle = css(faceColour(CREAM, 0.82));
  g.beginPath();
  g.ellipse(cx, cy - ry * 0.25, heartOf(m) * Math.hypot(e.ux, e.uy) * 1.35, heartOf(m) * Math.hypot(e.ux, e.uy) * 0.75, 0, 0, TAU);
  g.fill();
  const sh = g.createRadialGradient(cx, cy - ry * 0.2, 0, cx, cy - ry * 0.2, rx);
  sh.addColorStop(0, 'rgba(120, 60, 80, 0.32)');
  sh.addColorStop(0.7, 'rgba(120, 60, 80, 0.16)');
  sh.addColorStop(1, 'rgba(120, 60, 80, 0)');
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(cx, cy - ry * 0.2, rx, ry, 0, 0, TAU);
  g.fill();
  }
  // Settled into it: nothing of it below the near edge of the dip.
  g.save();
  g.beginPath();
  g.moveTo(box[0] - 2, box[1] - 2);
  g.lineTo(box[2] + 2, box[1] - 2);
  g.lineTo(box[2] + 2, cy - ry * 0.3);
  g.ellipse(cx, cy - ry * 0.3, Math.max(rx, (box[2] - box[0]) / 2 + 2), ry, 0, 0, Math.PI);
  g.lineTo(box[0] - 2, cy - ry * 0.3);
  g.closePath();
  g.clip();
  g.translate(cx, cy + sink);
  const z = k * size;
  // A little lower and longer than it stands: settled, not perched.
  g.scale(z * len, z * sq);
  // Inked as a body is at the island's zoom (\`inkAt\` in beasts.ts), its eyes shut.
  const step = scale * z;
  drawKind(g, kind, kit, paletteFor(key, kind, colors), facing, a, Math.max(1.1, 0.7 * step / size) / step, 1 / step, true);
  g.restore();
  const head = [cx + ((ext.x0 + ext.x1) / 2) * z * 0.5, cy + sink + ext.y0 * z * sq] as [number, number];
  return { sheet, foot: [cx, cy], head, area: sheet.canvas.width * sheet.canvas.height };
}

const lay = (ctx: Ctx, s: Sheet, sx: number, sy: number, zoom: number): void => {
  ctx.drawImage(s.canvas, sx + s.x * zoom, sy + s.y * zoom, s.w * zoom, s.h * zoom);
};

/** Seconds to a breath of a sleeper, and to a `z` rising off it. */
const BREATH = 3.6;
const Z_RISE = 2.8;

/**
 * Draw a wildermon bed of `kind` whose footprint's middle is at (sx, sy) on
 * the screen, turned as `view` says (`pieceView`): empty, one picture; with a
 * sleeper (`look`), the basket's far half, the sleeper breathing on its
 * cushion, and its near half, and unless `live` is false its `z` over it
 * (`drawDenLive`). Returns what it covers from (sx, sy) in screen pixels.
 */
export function drawDen(ctx: Ctx, sx: number, sy: number, zoom: number, kind: string, view: DenView, look: DenLook = {}, t = performance.now() / 1000, live = true): [number, number, number, number] {
  const stage = denStage(kind) ?? 0;
  const b = soon(stage, view, zoom);
  if (!look.sleeper) lay(ctx, b.whole, sx, sy, zoom);
  else {
    lay(ctx, b.back, sx, sy, zoom);
    const s = sleeperSoon(stage, view, zoom, look.sleeper);
    // Its breath: the curl swelling up off the cushion and settling.
    const k = 1 + 0.045 * Math.sin(((t + (look.sleeper.seed ?? 0) * 0.37) / BREATH) * TAU);
    const fx = sx + s.foot[0] * zoom, fy = sy + s.foot[1] * zoom;
    ctx.drawImage(s.sheet.canvas, sx + s.sheet.x * zoom, fy + (sy + s.sheet.y * zoom - fy) * k, s.sheet.w * zoom, s.sheet.h * zoom * k);
    void fx;
    lay(ctx, b.front, sx, sy, zoom);
    if (live) drawDenLive(ctx, sx, sy, zoom, kind, view, look, t);
  }
  const [l, tp, r, bt] = b.bounds;
  return [l * zoom, tp * zoom, r * zoom, bt * zoom];
}

/** What moves over a bed: a sleeper's `z`, rising off its head, drifting and fading. */
export function drawDenLive(ctx: Ctx, sx: number, sy: number, zoom: number, kind: string, view: DenView, look: DenLook = {}, t = performance.now() / 1000, night = 0, over = 0): void {
  const stage = denStage(kind) ?? 0;
  if (night > 0.02) {
    /*
     * The bells' warm light as the dark comes on, added here in the bed's own
     * place among what is drawn, so whatever stands in front is drawn over
     * it; turned up by as much as the night's wash will take off it there
     * (\`over\`, nought to one, after the bells' own pool of light,
     * \`denPools\`), as a forge's fire is, so it comes up through the wash
     * as a light and not a dimmed picture of one.
     */
    const n = bellsOf(soon(stage, view, zoom)), w = n && (look.sleeper ? n.glowSlept : n.glow);
    if (w) {
      const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter';
      // Turned up a little where the wash will take most of it, never past once and a fifth: added light over a painted bell clips it to white.
      const k = Math.min(1.2, Math.min(1, night) * (0.8 + 0.1 * Math.sin((t / 5.2) * TAU)) * (1 + 0.5 * Math.max(0, over)));
      for (let a = k; a > 0.01; a -= 1) {
        ctx.globalAlpha = wasA * Math.min(1, a);
        lay(ctx, w, sx, sy, zoom);
      }
      ctx.globalCompositeOperation = was;
      ctx.globalAlpha = wasA;
    }
  }
  if (!look.sleeper) return;
  const s = sleeperSoon(stage, view, zoom, look.sleeper);
  const off = (look.sleeper.seed ?? 0) * 0.61;
  // At least seven pixels tall at the furthest zoom, so empty and asleep are told apart from across a deed.
  const size = (7 + stage) * (1 + (zoom - 1) * 0.5);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const u = (((t + off) / Z_RISE + i * 0.5) % 1 + 1) % 1;
    const a = Math.sin(Math.PI * Math.min(1, u * 1.25)) * 0.95;
    if (a < 0.03) continue;
    const z = size * (1 + 0.25 * u);
    const x = sx + s.head[0] * zoom + (3 + 7 * u + Math.sin(u * 5 + i) * 1.2) * zoom;
    const y = sy + s.head[1] * zoom - (3 + 14 * u) * zoom * (0.8 + 0.2 * stage);
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(x - z / 2, y - z / 2);
    ctx.lineTo(x + z / 2, y - z / 2);
    ctx.lineTo(x - z / 2, y + z / 2);
    ctx.lineTo(x + z / 2, y + z / 2);
    ctx.strokeStyle = 'rgba(74, 56, 96, 0.92)';
    ctx.lineWidth = Math.max(2, z * 0.42);
    ctx.stroke();
    ctx.strokeStyle = '#f4ecff';
    ctx.lineWidth = Math.max(1, z * 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The soft light a bed and its bells throw after dark, for the night's light layer
 * (`Renderer.lights`, as a rune lantern's pool is): a little of the dark taken
 * off the bed, about as wide as its basket, a lavender cast in it; null for a
 * bed with no bells.
 */
export function denPools(kind: string, [x, y]: [number, number], facing: Side, rotation: number): LightSource[] {
  const stage = denStage(kind);
  if (!stage) return [];
  const m = modelOf(stage), sp = m.spec;
  // About as wide as its basket, faint: only the little the dark gives back round the bed.
  const out: LightSource[] = [{ x, y, radius: (sp.R / UNITS_PER_TILE) * 1.1, strength: 0.18, steady: true, cast: '205, 170, 240', castAlpha: 0.04 }];
  if (m.bellsAt) {
    /*
     * And the light of the bells themselves, where they hang: the night's
     * light is cut on the ground under where it is put, so this is put that
     * far up the screen from their place on the ground as they hang over it
     * (`runeLanternPool` puts its pool down the screen the same way), and
     * reaches no further than the bells do.
     */
    const [ax, ay] = ACROSS_OF[facing], [fx, fy] = FRONT_OF[facing];
    const [bx, by, bz] = m.bellsAt;
    const wx = x + (ax * bx + fx * by) / UNITS_PER_TILE, wy = y + (ay * bx + fy * by) / UNITS_PER_TILE;
    const { cos, sin } = VIEWS[((rotation % 8) + 8) % 8];
    const k = (bz * HEIGHT_SCALE) / (2 * HALF_H);
    out.push({ x: wx - k * (cos - sin), y: wy - k * (sin + cos), radius: (sp.R / UNITS_PER_TILE) * 1.05, strength: 0.55, steady: true, cast: '255, 196, 214', castAlpha: 0.1 });
  }
  return out;
}

/** Which way a piece's width and its front run in the world, as it is set facing (\`pieceView\` in furniture.ts). */
const ACROSS_OF: Record<Side, [number, number]> = { s: [1, 0], e: [0, -1], n: [-1, 0], w: [0, 1] };
const FRONT_OF: Record<Side, [number, number]> = { s: [0, 1], e: [1, 0], n: [0, -1], w: [-1, 0] };

/** What a bed is clicked by, from its footprint's middle, in pixels at zoom one: its basket and its hood. */
export function denHit(kind: string, view: DenView, zoom = 1): [number, number, number, number] {
  return soon(denStage(kind) ?? 0, view, zoom).hit;
}

/** What it is drawn over, from its footprint's middle, in pixels at zoom one. */
export function denBounds(kind: string, view: DenView, zoom = 1): [number, number, number, number] {
  return soon(denStage(kind) ?? 0, view, zoom).bounds;
}

/**
 * For a harness or a test: how much of its bed's cushion a sleeper of a kind
 * at a stage covers, nought to one, as it is seen from a view -- across (the
 * share of the cushion's width its body lies over) and by area (the share of
 * the flower's own outline its picture hides). Reads pixels back; never
 * called while the island is drawn.
 */
export function sleeperCover(kind: string, view: DenView, species: string, its: number, colors: [string, string]): { across: number; area: number; clear: number } {
  const stage = denStage(kind) ?? 0, m = modelOf(stage), e = eyeOfView(view);
  const later = its > 0 ? WILDERMON_STAGES[species]?.[its - 1] : undefined;
  const kindOf = later ?? WILDERMON[species];
  if (!kindOf) return { across: 0, area: 0, clear: 0 };
  // Its own picture alone, without the shade and the pressed heart laid under it.
  const s = modelSleeper(stage, e, 1, later ? `${species}@${its}` : species, kindOf, colors, true);
  const { canvas } = s.sheet, k = canvas.width / s.sheet.w;
  const d = (canvas.getContext('2d') as Ctx).getImageData(0, 0, canvas.width, canvas.height).data;
  const at = (x: number, y: number): boolean => {
    const px = Math.floor((x - s.sheet.x) * k), py = Math.floor((y - s.sheet.y) * k);
    return px >= 0 && py >= 0 && px < canvas.width && py < canvas.height && d[(py * canvas.width + px) * 4 + 3] > 200;
  };
  const ring = Array.from({ length: 32 }, (_, i) => proj(e, onRing(m.ri, (i / 32) * TAU, m.zc)));
  const inside = (x: number, y: number): boolean => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const X0 = Math.floor(Math.min(...xs)), X1 = Math.ceil(Math.max(...xs)), Y0 = Math.floor(Math.min(...ys)), Y1 = Math.ceil(Math.max(...ys));
  let all = 0, hit = 0, cols = 0, over = 0;
  for (let x = X0; x <= X1; x++) {
    cols++;
    let col = false;
    for (let y = Math.floor(s.sheet.y); y <= Y1; y++) if (at(x, y)) { col = true; break; }
    if (col) over++;
    for (let y = Y0; y <= Y1; y++) {
      if (!inside(x, y)) continue;
      all++;
      if (at(x, y)) hit++;
    }
  }
  // How far under the height the bells hang clear of its top is, in pixels at zoom one: never less than nought.
  let top = Infinity;
  for (let py = 0; py < canvas.height && top === Infinity; py++) for (let px = 0; px < canvas.width; px++) if (d[(py * canvas.width + px) * 4 + 3] > 200) { top = s.sheet.y + py / k; break; }
  const ceiling = proj(e, [0, 0, sleeperTopOf(stage, m.zc)])[1];
  return { across: cols ? over / cols : 0, area: all ? hit / all : 0, clear: top - ceiling };
}

/** Whether a kind of piece is a wildermon bed, drawn here. */
export const isDen = (kind: string): boolean => denStage(kind) !== undefined;
