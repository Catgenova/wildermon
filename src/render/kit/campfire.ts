import { FIRE_CAPACITY } from '../../game/campfire';
import { rand } from '../ivy';
import { area2, canvasOf, cut, eyeOf, glyphPath, RUNE_GOLD, RUNE_WHITE, scaleFor, type Eye } from '../runestone';
import { layKitModel } from '../kitpieces';
import { flame, glow, lilac, speckle } from './hearthstone';
import {
  css, deeper, extrude, faceColour, grain, hex, lathe, mix, moved, paler, proj, slab, TAU, toneOf, turned, woodTone,
  type Ctx, type KitModel, type KitPart, type PaintCtx, type Pt, type RGB, type Side, type Tone, type V3,
} from './core';

/**
 * The campfire (`PlacedCampfire`, two by two subtiles), in the kit: a ring of
 * nine cut runestones round a pit, each with a kenaz cut in its outer face,
 * and in the pit split logs laid in a star, leaning in to a teepee as more is
 * fed to it -- two of them for the least fuel, five for a full fire, their
 * inner ends charred once it has burned. Out of fuel the logs are gone and a
 * mound of ash and charcoal is left; ashes waiting to be raked lie as a pale
 * bed under the logs.
 *
 * What is still is baked for each turn of the camera, state and scale; what
 * moves is drawn over the bake every frame (`drawCampfire`): the tongues of
 * the fire, sized by its fuel, the glow on the pit and the sparks going up.
 * After dark the fire and its glow are laid again as light over the wash
 * (`drawCampfireNight`). The smoke over it and its light on the ground are
 * the renderer's (`Game.fires`, `Game.lights`).
 */

/* ---- its measures, in tenths of a metre ------------------------------------------- */

/** The ring: how far out its stones stand, how many, and each one's length round it, depth across it and height. */
const R = 9.2, STONES = 9, STONE_L = 4.5, STONE_D = 2.5, STONE_H = 2.1;
/** The pit inside the stones. */
const PIT = R - STONE_D / 2 - 0.15;
/** Where the logs' inner ends stop short of the middle. */
const LOG_IN = 0.8;
/** By fuel level (`levelOf`, nought to four): how many logs, how long, and how far their inner ends lean up. */
export const CAMPFIRE_LOGS = [0, 2, 3, 4, 5];
const LOG_LEN = [0, 5.4, 6.0, 6.5, 7.0];
const LOG_LEAN = [0, 0.12, 0.22, 0.42, 0.62];

/* ---- its colours ------------------------------------------------------------------- */

/** The ring's stones, a hair apart from each other as the runestones' are. */
const RING: Tone[] = [toneOf('#ece0d0', '#a48cb2'), toneOf('#e6e4d6', '#9592bc'), toneOf('#f3ded0', '#b48eaa')];
/** Bark, the split wood and its end grain (the firewood rack's). */
const BARK: Tone = deeper(woodTone('oak'), 0.62);
const SPLIT: Tone = paler(woodTone('pine'), 0.1);
/** Wood burned black at its end, a deep plum, never black. */
const CHAR: RGB = hex('#4e3a4c');
/** Ash: a pale lilac grey, as a mound; and the bed of a pit with no fire in it. */
const ASH: Tone = toneOf('#ddd5d8', '#a097a8');
const BED_COLD = '#a28aa6';
const BED_LIT = '#b8483a';
/** Embers and the gold a lit rune's channel takes. */
const EMBER = '#ffb456';
const EMBER_HOT = '#fff0c4';

/* ---- what state it is in ------------------------------------------------------------ */

/** How full a fire is, nought (no fuel) to four (more than three quarters of what it holds). */
export const levelOf = (fuel: number): number => (fuel <= 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((4 * fuel) / FIRE_CAPACITY))));
/** Under this share of what it holds, a lit fire is dying: its logs burned to stubs, its flames low over the embers. */
const DYING = 0.04;
/** How tall its flames stand, nought to one: lit, by its fuel, full from half of what it holds. */
export const flameOf = (lit: boolean, fuel: number): number => {
  if (!lit) return 0;
  const share = Math.max(0, fuel) / FIRE_CAPACITY;
  return share < DYING ? 0.3 : 0.45 + 0.55 * Math.min(1, share / 0.5);
};

interface FireLook { lit: boolean; level: number; dying: boolean; ash: boolean }
const lookOf = (lit: boolean, fuel: number, ash: number): FireLook => ({
  lit, level: levelOf(fuel), dying: lit && fuel > 0 && fuel / FIRE_CAPACITY < DYING, ash: ash >= 1,
});

/* ---- the stones --------------------------------------------------------------------- */

/** A kenaz cut in a stone's outer face: plain cut while it is cold, its channel laid with ember gold while the fire burns. */
function runeFace(lit: boolean, seed: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    speckle(g, k.fill, s.w, s.h, seed, 0.7);
    lilac(g, k.L, s.w, s.h);
    const x = s.w / 2, y = s.h * 0.52, sz = Math.min(0.62, s.h * 0.3);
    const w = 0.34;
    cut(g, k.fill, w * 1.25, () => glyphPath(g, 'kenaz', x, y, sz));
    if (!lit) return;
    glyphPath(g, 'kenaz', x, y, sz);
    g.strokeStyle = RUNE_GOLD;
    g.lineWidth = w * 0.8;
    g.stroke();
    glyphPath(g, 'kenaz', x, y, sz);
    g.strokeStyle = css(mix(hex(RUNE_WHITE), hex(RUNE_GOLD), 0.35), 0.9);
    g.lineWidth = w * 0.3;
    g.stroke();
  };
}

/** The face toward the fire: soot up from its foot, warm while it burns. */
function sooted(lit: boolean, seed: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    speckle(g, k.fill, s.w, s.h, seed, 0.5);
    const gr = g.createLinearGradient(0, 0, 0, s.h);
    gr.addColorStop(0, css(mix(k.fill, hex('#5a4458'), 0.55), 0.7));
    gr.addColorStop(1, css(mix(k.fill, hex('#5a4458'), 0.55), 0));
    g.fillStyle = gr;
    g.fillRect(-0.5, 0, s.w + 1, s.h);
    if (lit) { g.fillStyle = 'rgba(255, 168, 96, 0.18)'; g.fillRect(-0.5, 0, s.w + 1, s.h); }
  };
}

function stonesOf(lit: boolean): KitPart[] {
  const T = rand(41);
  const parts: KitPart[] = [];
  for (let i = 0; i < STONES; i++) {
    const a = (i / STONES) * TAU + 0.35 + (T() - 0.5) * 0.12;
    const L = STONE_L * (0.88 + 0.24 * T()), D = STONE_D * (0.9 + 0.2 * T()), H = STONE_H * (0.82 + 0.3 * T());
    // Each stone its own hair of the ring's stone, warmer or cooler, as the runestones' rocks are.
    const k = T();
    const tone: Tone = { lit: mix(RING[0].lit, RING[k < 0.5 ? 2 : 1].lit, 0.2 + 0.4 * T()), shade: mix(RING[0].shade, RING[k < 0.5 ? 2 : 1].shade, 0.3) };
    // Built with its outer face to the front (y), turned so the front looks out from the middle, and set on the ring.
    const local = slab(-L / 2, L / 2, -D / 2, D / 2, 0, H, tone, {
      corner: 0.4, bevel: 0.38, taper: -0.14, crease: 0.42,
      paint: {
        front: runeFace(lit, 60 + i),
        back: sooted(lit, 80 + i),
        left: (g, k, s) => { speckle(g, k.fill, s.w, s.h, 90 + i, 0.6); lilac(g, k.L, s.w, s.h); },
        right: (g, k, s) => { speckle(g, k.fill, s.w, s.h, 100 + i, 0.6); lilac(g, k.L, s.w, s.h); },
        top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); speckle(g, k.fill, s.w, s.h, 110 + i, 0.6); g.restore(); },
      },
    });
    const faces = moved(turned(local, [0, 0, 0], [0, 0, 1], a - Math.PI / 2), [Math.cos(a) * R, Math.sin(a) * R, 0]);
    parts.push({ faces, edges: true });
  }
  return parts;
}

/* ---- the logs ------------------------------------------------------------------------- */

/** A split log's end, as it lies: a half round (flat side down) or a wedge split from the heart (bark down, the heart up). */
const HALF: Pt[] = [[-1.1, 0], ...Array.from({ length: 5 }, (_, j) => { const t = (j / 4) * Math.PI; return [Math.cos(t) * 1.1, Math.sin(t) * 1.1] as Pt; }).reverse()];
const WEDGE_C: Pt = [0, 1.55];
const WEDGE: Pt[] = [WEDGE_C, ...Array.from({ length: 5 }, (_, j) => {
  const t = -Math.PI / 2 - 0.75 + (j / 4) * 1.5;
  return [WEDGE_C[0] + Math.cos(t) * 1.6, WEDGE_C[1] + Math.sin(t) * 1.6] as Pt;
})];

/** Its end grain: the sawn face and its rings about the heart, or charred black-plum with embers in its checks while it burns. */
function endGrain(heart: Pt, charred: boolean, lit: boolean, seed: number) {
  return (g: Ctx, k: PaintCtx): void => {
    const T = rand(seed);
    if (charred) {
      g.fillStyle = css(mix(CHAR, k.fill, 0.18));
      g.fillRect(-3, -1, 6, 4);
      if (lit) {
        g.strokeStyle = EMBER;
        g.lineWidth = 0.14;
        g.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const a = T() * TAU;
          g.beginPath();
          g.moveTo(heart[0], heart[1]);
          g.lineTo(heart[0] + Math.cos(a) * 0.9, heart[1] + Math.sin(a) * 0.9);
          g.stroke();
        }
      }
      return;
    }
    const fill = faceColour(SPLIT, k.L);
    g.fillStyle = css(fill);
    g.fillRect(-3, -1, 6, 4);
    g.strokeStyle = css(mix(fill, hex('#8a6a58'), 0.4), 0.5);
    g.lineWidth = 0.08;
    for (const r of [0.45, 0.85, 1.25]) { g.beginPath(); g.arc(heart[0], heart[1], r, 0, TAU); g.stroke(); }
    g.beginPath();
    g.arc(heart[0], heart[1], 0.12, 0, TAU);
    g.fillStyle = css(mix(fill, hex('#6e5060'), 0.5));
    g.fill();
  };
}

/**
 * One split log in the star: from `LOG_IN` out along `phi` for `len`, its
 * inner end leaning up by `lean`, charred along `char` of it from that end.
 */
function logOf(phi: number, len: number, lean: number, wedge: boolean, char: number, lit: boolean, seed: number): KitPart {
  const outline = wedge ? WEDGE : HALF;
  const wound = area2(outline) < 0 ? outline.slice().reverse() : outline;
  const heart: Pt = wedge ? WEDGE_C : [0, 0.05];
  // Which edges of its end are bark: round the outside, not the split faces.
  const barkEdge = (i: number): boolean => {
    const p = wound[i], q = wound[(i + 1) % wound.length];
    if (wedge) return !(p === WEDGE_C || q === WEDGE_C);
    return !(Math.abs(p[1]) < 1e-6 && Math.abs(q[1]) < 1e-6);
  };
  const half = len / 2;
  // Bark is its tone, so the narrow strips round it are bark even where they are too small to paint; the split faces and the ends are painted pale.
  const faces = extrude([LOG_IN, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], outline, 0, len, BARK, 0.16, {
    back: endGrain(heart, char > 0, lit, seed),
    front: endGrain(heart, false, lit, seed + 1),
    edge: (i) => ({
      crease: 0.3,
      paint: (g: Ctx, k: PaintCtx) => {
        const T = rand(seed * 7 + i);
        const bark = barkEdge(i);
        const fill = bark ? k.fill : faceColour(SPLIT, k.L);
        if (!bark) { g.fillStyle = css(fill); g.fillRect(-1, -half - 1, 4, len + 2); }
        // Bark in long fissures; split wood in its grain, run along the log.
        if (bark) {
          g.lineCap = 'round';
          for (let n = 0; n < Math.round(len * 1.4); n++) {
            const x = T() * 2.4, y0 = -half + T() * len, l = 0.8 + T() * 1.6;
            g.strokeStyle = T() < 0.6 ? css(mix(fill, hex('#3e3040'), 0.35), 0.55) : css(mix(fill, [255, 236, 214], 0.25), 0.45);
            g.lineWidth = 0.1;
            g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (T() - 0.5) * 0.2, y0 + l); g.stroke();
          }
        } else {
          g.save();
          g.translate(0, -half);
          grain(g, fill, 3, len, seed + i, 'y', 0.8);
          g.restore();
        }
        // Burned from its inner end: black-plum along the charred length, a band of brown where the char gives out, embers in it while it burns.
        if (char > 0) {
          const y1 = -half + len * char;
          const gr = g.createLinearGradient(0, -half, 0, y1 + 0.6);
          gr.addColorStop(0, css(CHAR));
          gr.addColorStop(Math.max(0, (y1 - 0.3 + half) / (len * char + 0.6)), css(CHAR, 0.95));
          gr.addColorStop(1, css(mix(fill, hex('#6a4a46'), 0.5), 0));
          g.fillStyle = gr;
          g.fillRect(-1, -half - 0.5, 4, len * char + 1.1);
          if (lit) {
            g.fillStyle = EMBER;
            for (let n = 0; n < Math.round(len * char * 1.6); n++) {
              const y = -half + T() * len * char * 0.9;
              g.fillRect(T() * 2, y, 0.32 + T() * 0.3, 0.12);
            }
          }
        }
      },
    }),
  });
  // Lean its inner end up about its outer foot, then turn it out along `phi`.
  const foot: V3 = [LOG_IN + len, 0, 0];
  const leant = lean ? turned(faces, foot, [0, 1, 0], lean) : faces;
  return { faces: turned(leant, [0, 0, 0], [0, 0, 1], phi), edges: true };
}

function logsOf(f: FireLook): KitPart[] {
  const n = CAMPFIRE_LOGS[f.level];
  if (!n) return [];
  const T = rand(17 + f.level);
  const parts: KitPart[] = [];
  // Burned: their inner ends charred once it has burned (lit, or anything short of a freshly laid fire), to stubs when dying.
  const char = f.dying ? 0.75 : f.lit ? 0.32 : f.level >= 2 ? 0.22 : 0;
  const len = f.dying ? 3.4 : LOG_LEN[f.level];
  const lean = f.dying ? 0.06 : LOG_LEAN[f.level];
  for (let i = 0; i < n; i++) {
    const phi = (i / n) * TAU + 2.2 + (T() - 0.5) * 0.25;
    parts.push(logOf(phi, len * (0.92 + 0.14 * T()), lean * (0.85 + 0.3 * T()), (i + f.level) % 2 === 0, char, f.lit, 200 + i * 13 + f.level));
  }
  return parts;
}

/* ---- the pit -------------------------------------------------------------------------- */

/** The bed of the pit, laid first: ash or embers, with coals in it. */
function bedOf(f: FireLook): KitPart {
  const T0 = 300 + f.level;
  const reach: V3[] = [[-PIT, -PIT, 0], [PIT, -PIT, 0], [PIT, PIT, 0], [-PIT, PIT, 0]];
  return {
    first: true, solid: false, reach,
    draw: (g, e) => {
      const T = rand(T0);
      const ring = (r: number): void => {
        g.beginPath();
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          const [x, y] = proj(e, [Math.cos(a) * r, Math.sin(a) * r, 0]);
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.closePath();
      };
      // The pit's rim, dug a step into the turf, and its bed.
      ring(PIT + 0.4);
      g.fillStyle = css(hex('#6a4f78'), 0.55);
      g.fill();
      ring(PIT - 0.2);
      g.fillStyle = f.lit ? BED_LIT : f.ash || !f.level ? '#c4bcc4' : BED_COLD;
      g.fill();
      // Ash in drifts, and coals: glowing while it burns, charcoal once it is out.
      const coals = f.lit ? 22 : 14;
      for (let i = 0; i < coals; i++) {
        const a = T() * TAU, r = Math.sqrt(T()) * (PIT - 1.2);
        const [x, y] = proj(e, [Math.cos(a) * r, Math.sin(a) * r, 0]);
        g.beginPath();
        g.ellipse(x, y, 0.9 + 0.6 * T(), 0.5 + 0.3 * T(), (T() - 0.5) * 0.6, 0, TAU);
        g.fillStyle = f.lit ? (i % 3 ? EMBER : EMBER_HOT) : i % 3 ? css(CHAR) : '#d8d0d6';
        g.fill();
      }
      if (f.lit) {
        const [x, y] = proj(e, [0, 0, 0]);
        g.save();
        g.globalCompositeOperation = 'lighter';
        glow(g, x, y, PIT * 1.4, 0.32, '255, 170, 90');
        g.restore();
      }
    },
  };
}

/** Out of fuel: a mound of ash in the middle of the pit, charcoal in it, embers still in it while it is lit. */
function ashOf(f: FireLook): KitPart {
  const profile: Array<[number, number]> = [[0, 4.6], [0.5, 4.0], [1.0, 2.9], [1.35, 1.6], [1.5, 0.5]];
  const flecks = (seed: number) => (g: Ctx, kk: PaintCtx, s: Side): void => {
    const T = rand(seed);
    for (let m = 0; m < Math.max(2, Math.round(s.w * s.h * 1.2)); m++) {
      g.fillStyle = T() < 0.45 ? css(CHAR, 0.85) : f.lit ? EMBER : css(mix(kk.fill, [255, 252, 246], 0.45), 0.7);
      g.fillRect(T() * s.w, T() * s.h, 0.35 + T() * 0.45, 0.22 + T() * 0.25);
    }
  };
  const faces = lathe(0, 0, profile, 12, ASH, 0.5, (k, i, s) => ({ crease: 0.12, paint: (g: Ctx, kk: PaintCtx) => flecks(500 + k * 12 + i)(g, kk, s) }));
  return { faces, edges: false };
}

function campfireOf(f: FireLook): KitModel {
  const parts: KitPart[] = [bedOf(f), ...stonesOf(f.lit)];
  if (f.level === 0) parts.push(ashOf(f));
  parts.push(...logsOf(f));
  return { parts, shade: null };
}

/* ---- kept pictures ---------------------------------------------------------------------- */

interface Bake { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number; hit: [number, number, number, number] }
const bakes = new Map<string, Bake>();
const BAKES_KEPT = 96;
const models = new Map<string, KitModel>();

const keyOf = (f: FireLook): string => `${f.lit ? 1 : 0}${f.level}${f.dying ? 1 : 0}${f.ash ? 1 : 0}`;
const eyeAt = (turn: number): Eye => eyeOf(0, ((turn % 8) + 8) % 8);

function bakeOf(f: FireLook, turn: number, scale: number): Bake {
  const k = keyOf(f);
  const key = `${k}|${turn}|${scale}`;
  let b = bakes.get(key);
  if (b) { bakes.delete(key); bakes.set(key, b); return b; }
  let m = models.get(k);
  if (!m) models.set(k, (m = campfireOf(f)));
  const e = eyeAt(turn);
  const { bounds, hit } = layKitModel(null, m, e);
  const [x0, y0, x1, y1] = bounds;
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  layKitModel(g, m, e);
  b = { canvas, x: x0, y: y0, w: x1 - x0, h: y1 - y0, hit };
  bakes.set(key, b);
  if (bakes.size > BAKES_KEPT) bakes.delete(bakes.keys().next().value as string);
  return b;
}

/** Where a campfire is clicked, from its middle in pixels at zoom one: left, top, right and bottom, round its stones, its logs and its flames. */
export function campfireHit(lit: boolean, fuel: number, turn = 0, ash = 0): [number, number, number, number] {
  const [l, t, r, b] = bakeOf(lookOf(lit, fuel, ash), turn, 1).hit;
  return [l, Math.min(t, -FLAME_H * flameOf(lit, fuel) - 2), r, b];
}

/* ---- what moves -------------------------------------------------------------------------- */

/** The tallest the fire stands, in pixels at zoom one, and how wide its middle tongue is. */
const FLAME_H = 21, FLAME_W = 9.5;
/** Sparks: how many at the most, the seconds each takes to rise and go out, and how high it gets in pixels at zoom one. */
const SPARKS = 8, SPARK_SECS = 1.7, SPARK_RISE = 30;

/** The fire's tongues over (x, y) at zoom one: a middle fire and two smaller beside it, each on its own beat, as tall as `h` says. */
function tongues(g: Ctx, x: number, y: number, h: number, t: number): void {
  const W = FLAME_W * (0.55 + 0.45 * h), H = FLAME_H * h;
  // The flickers run on the clock, smooth: `flame`'s licks take any number, and its sway is swung here.
  const f = (k: number): number => t * 3.1 + k;
  const sway = (k: number): number => Math.sin(t * 2.3 + k) * 0.8;
  if (h > 0.45) {
    flame(g, x - W * 0.55 + sway(1), y + 0.6, W * 0.62, H * 0.62, 3, f(1.7));
    flame(g, x + W * 0.5 + sway(2), y + 0.8, W * 0.58, H * 0.56, 7, f(3.9));
  }
  flame(g, x + sway(0) * 0.6, y + 0.4, W, H, 1, f(0));
  // Coals heaped where the tongues stand out of them, over their feet: a few lumps along the foot, deep orange under a lit top.
  const n = h > 0.45 ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    const cx = x + u * W * (h > 0.45 ? 1.7 : 1.1), cy = y + 0.9 - Math.abs(u) * 0.8 + (i % 2) * 0.5;
    const r = (1.5 + ((i * 7) % 3) * 0.35) * (0.7 + 0.3 * h);
    g.beginPath();
    g.ellipse(cx, cy, r, r * 0.62, 0, 0, TAU);
    g.fillStyle = '#c9503c';
    g.fill();
    g.beginPath();
    g.ellipse(cx - r * 0.15, cy - r * 0.18, r * 0.66, r * 0.36, 0, 0, TAU);
    g.fillStyle = i % 2 ? '#ffb456' : '#ffd27e';
    g.fill();
  }
}

/** The sparks going up off it, each on its own cycle, drifting and going out: (x, y) its middle at zoom one. */
function sparks(g: Ctx, x: number, y: number, h: number, t: number, zoom: number, seed: number): void {
  const n = Math.round(SPARKS * h);
  for (let i = 0; i < n; i++) {
    const phase = ((seed * 0.37 + i * 0.618) % 1 + 1) % 1;
    const u = ((t / SPARK_SECS + phase) % 1 + 1) % 1;
    const a = (1 - u) * (u < 0.15 ? u / 0.15 : 1);
    if (a < 0.05) continue;
    const off = (((i * 7 + seed * 3) % 9) / 9 - 0.5) * FLAME_W * 1.2;
    const sx = x + (off + Math.sin(u * 7 + i) * 2.2 * u) * zoom;
    const sy = y - (FLAME_H * h * 0.4 + u * SPARK_RISE * (0.6 + 0.4 * h)) * zoom;
    const r = (0.75 - 0.35 * u) * zoom;
    g.fillStyle = css(mix(hex('#fff0b8'), hex('#ff8a4a'), u), a);
    g.beginPath();
    g.moveTo(sx, sy - r * 1.4); g.lineTo(sx + r, sy); g.lineTo(sx, sy + r * 1.4); g.lineTo(sx - r, sy);
    g.closePath();
    g.fill();
  }
}

/**
 * A campfire whose middle is at (sx, sy), as the camera's `turn` sees it:
 * its stones, its logs as its `fuel` (seconds) has them, its `ash` (lots of
 * it waiting to be raked) and, `lit`, its fire drawn over that at `time`
 * seconds -- tongues as tall as its fuel, the glow on its pit, its sparks.
 */
export function drawCampfire(ctx: Ctx, sx: number, sy: number, zoom: number, lit: boolean, fuel: number, time: number, turn = 0, ash = 0): void {
  const look = lookOf(lit, fuel, ash);
  const b = bakeOf(look, turn, scaleFor(zoom));
  ctx.drawImage(b.canvas, sx + b.x * zoom, sy + b.y * zoom, b.w * zoom, b.h * zoom);
  if (!lit) return;
  const h = flameOf(lit, fuel);
  const y = sy - 1.2 * zoom;
  ctx.save();
  // The glow on the pit and on the stones' inner faces, breathing with the fire.
  const breath = 0.85 + 0.15 * Math.sin(time * 5.3) * Math.sin(time * 2.1 + 1);
  glow(ctx, sx, y - 4 * zoom * h, (FLAME_W * 2.6) * zoom, 0.34 * breath);
  ctx.translate(sx, y);
  ctx.scale(zoom, zoom);
  tongues(ctx, 0, 0, h, time);
  ctx.restore();
  sparks(ctx, sx, y, h, time, zoom, 3);
}

/**
 * After dark, its fire and its glow again as light, as much as the wash
 * will take off them there (`over`, nought to one: `Renderer.nightOver`,
 * which counts its own light already cleared off it), as dark as it is
 * (`night`).
 */
export function drawCampfireNight(ctx: Ctx, sx: number, sy: number, zoom: number, fuel: number, night: number, time: number, over = 0): void {
  if (night <= 0.02) return;
  const h = flameOf(true, fuel);
  const y = sy - 1.2 * zoom;
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  // As much again as the wash will take off it: none where its own light has already cleared the wash away.
  const o = Math.max(0, Math.min(0.95, over));
  const k = Math.min(1, (o / (1 - o)) * Math.min(1, night / 0.5));
  const breath = 0.85 + 0.15 * Math.sin(time * 5.3) * Math.sin(time * 2.1 + 1);
  ctx.globalAlpha = wasA * Math.min(1, k * 0.5);
  glow(ctx, sx, y + 2 * zoom, PIT * 1.6 * zoom, 0.45 * breath, '255, 140, 70');
  // The tongues laid as one picture, so where they overlap they are not added again and again into white.
  const pic = tonguePicture(h, time, zoom);
  ctx.globalAlpha = wasA * Math.min(1, k * 0.5);
  ctx.drawImage(pic.canvas, sx - pic.ax, y - pic.ay, pic.w, pic.h);
  ctx.globalAlpha = wasA * Math.min(1, k * 0.8);
  sparks(ctx, sx, y, h, time, zoom, 3);
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/** A canvas kept for the tongues at night, drawn afresh each frame: the fire's own picture, (ax, ay) its foot. */
let scratch: { canvas: HTMLCanvasElement; g: Ctx } | null = null;
function tonguePicture(h: number, t: number, zoom: number): { canvas: HTMLCanvasElement; ax: number; ay: number; w: number; h: number } {
  const w = Math.ceil(FLAME_W * 3.2 * zoom), ht = Math.ceil((FLAME_H * 1.15 + 3) * zoom);
  if (!scratch) {
    const [canvas, g] = canvasOf(w, ht);
    scratch = { canvas, g };
  }
  const c = scratch.canvas;
  if (c.width < w || c.height < ht) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, ht); }
  const g = scratch.g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  g.translate(w / 2, ht - 2 * zoom);
  g.scale(zoom, zoom);
  tongues(g, 0, 0, h, t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas: c, ax: w / 2, ay: ht - 2 * zoom, w: c.width, h: c.height };
}
