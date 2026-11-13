/**
 * Combat's action effects (`./registry.ts` ACTION_FX):
 *
 *   - `block`: a blow taken on the shield (`FigurePose.block`, at its impact `BLOCK_IMPACT`), at the shield's face. Metal:
 *     a fan of sparks off the face to either side in its metal and a ring glint; wood: splinters in its wood and a puff of
 *     its dust, no sparks. With Deflect held (`params.deflect`) a streak of light from the shield to what struck.
 *   - `hit`: a blow landing (`FigurePose.flinch`, at its snap), on the body where it landed (`params.where`), on the side it
 *     came from, by what is worn there: plate (and scale) sparks in its metal; chain small bright glints; leather a dull
 *     puff; cloth or nothing fibre fluff. No blood.
 *   - `heavy`: a two-handed weapon's blow (the overhead swing in a fight) at its blade's lowest point: a shock ring of the
 *     ground's dust, and on stone a crack that fades over `CRACK_SECS`. The blow is held (`FxMark.params.stop`, `./actions.ts`).
 *   - `twang`: a bow's string after the loose, a decaying flicker along it; `loose`: a faint streak where the arrow flies
 *     for `STREAK_SECS`, a spiral of gold motes off an enchanted bow.
 *   - `runes`: along an enchanted weapon's blow, a rune shed off its trail.
 */
import { isMetalTone } from '../figure';
import { PALETTE as GOLDS } from '../spells/blessing';
import { UNITS_PER_TILE } from '../iso';
import type { Body, P3 } from '../spells/kit';
import type { ActionKit } from './kit';
import { mixHex, shadeHex } from './material';
import type { ActionFxFn } from './registry';
import type { FxEvent } from './types';

/** Sparks off a metal shield, both sides together; splinters off a wooden one. */
export const BLOCK_SPARKS = 14;
export const SPLINTERS = 9;
/** Particles a blow landing throws off, before its level of detail. */
export const HIT_PUFF = 7;
/** Dust a heavy blow throws round in its ring. */
export const SHOCK_DUST = 10;
/** Tiles the heavy blow's ring of dust spreads to, and seconds it takes. */
export const SHOCK_REACH = 0.7;
const SHOCK_SECS = 0.32;
/** Seconds a heavy blow's crack in stone lasts. */
export const CRACK_SECS = 1;
/** Seconds the streak where an arrow flies lasts, and tiles it reaches. */
export const STREAK_SECS = 0.15;
const STREAK_TILES = 1.5;
/** Seconds a loosed string flickers. */
export const TWANG_SECS = 0.25;
/** Gold motes in an enchanted bow's spiral. */
export const SPIRAL_MOTES = 12;
/** Seconds a rune shed off an enchanted weapon's trail lasts. */
const RUNE_SECS = 0.5;
/** Seconds a Deflect's streak takes from the shield to what struck, and a block's ring glint. */
const DEFLECT_SECS = 0.22;
const GLINT_SECS = 0.12;

const WHITE = '#fffaf0';
const GOLD = [GOLDS.main, GOLDS.deep];
/** Cloth undyed, as fluff off it. */
const FLUFF = '#eee6d6';
/** A leather's dull puff. */
const LEATHER_DUST = '#a48766';

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
/** A body to turn a point round: where it stands and faces. */
const bodyOf = (e: FxEvent): Body => ({ x: e.body.x, y: e.body.y, z: e.body.z, facing: e.body.facing, tall: 17, wide: 4, kind: 'peer' });
/** A step along the ground in the body's own terms (right, ahead), tiles, unit length. */
function step(k: ActionKit, e: FxEvent, right: number, ahead: number): { x: number; y: number } {
  const b = bodyOf(e), o = k.local(b, 0, 0, 0), p = k.local(b, right * UNITS_PER_TILE, ahead * UNITS_PER_TILE, 0);
  const x = p.x - o.x, y = p.y - o.y, l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

const block: ActionFxFn = (e, k) => {
  const sh = k.mat.shield(e.pose);
  if (!sh) return;
  const right = step(k, e, 1, 0), left = { x: -right.x, y: -right.y };
  const half = Math.ceil(num(e.params.n, sh.metal ? BLOCK_SPARKS : SPLINTERS) / 2);
  if (sh.metal && sh.tone) {
    const m = sh.tone;
    // a fan to either side along the face, laid over in its metal, about a white-hot few
    for (const s of [right, left]) k.burst(e.at, half, { kind: 'spark', colour: [m.lit, m.blade, WHITE], size: 1.6, life: [0.14, 0.3], speed: [0.35, 0.9], up: [4, 18], gravity: 70, drag: 0.2, heading: s, cone: 0.8, over: true, jitterZ: 0.4 });
  } else {
    for (const s of [right, left]) k.burst(e.at, half, { kind: 'shard', colour: [sh.wood, sh.woodDark, mixHex(sh.wood, '#ffffff', 0.25)], size: 0.9, sizeEnd: 0.7, ink: false, life: [0.3, 0.45], speed: [0.2, 0.5], up: [6, 14], gravity: 70, drag: 0.4, spin: 3, heading: s, cone: 1.2, bias: 2 });
    k.burst(e.at, 3, { kind: 'dust', colour: mixHex(sh.wood, '#ffffff', 0.45), size: 1.8, sizeEnd: 5, life: [0.35, 0.55], speed: [0.04, 0.12], up: [0, 3], gravity: -2, drag: 0.3, small: true });
  }
  const to = e.params.deflect === true ? e.to : undefined, light = sh.tone?.lit ?? GOLDS.main;
  return {
    secs: to ? DEFLECT_SECS : GLINT_SECS,
    draw: (kk, u) => {
      // the ring glint, metal only: an ellipse on the face opening and going
      const g = u * (to ? DEFLECT_SECS / GLINT_SECS : 1);
      if (sh.metal && g < 1) {
        const x = kk.sx(e.at), y = kk.sy(e.at), r = (2 + 6 * g) * kk.zoom;
        kk.glowDraw((c) => {
          c.globalAlpha = 0.85 * (1 - g);
          c.strokeStyle = light;
          c.lineWidth = Math.max(0.8, 0.5 * kk.zoom);
          c.beginPath();
          c.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
          c.stroke();
        });
      }
      if (to) {
        // Deflect: the blow sent back, a streak from the shield to what struck
        const head = Math.min(1, u * 1.6), tail = Math.max(0, u * 1.6 - 0.45);
        const p = (w: number): P3 => ({ x: e.at.x + (to.x - e.at.x) * w, y: e.at.y + (to.y - e.at.y) * w, z: e.at.z + (to.z - e.at.z) * w });
        if (head > tail) kk.beam(p(tail), p(head), { main: GOLDS.main, core: GOLDS.core, ink: GOLDS.deep, width: 1.6, alpha: 1 - u * u, glow: 0.7, light: GOLDS.main });
      }
    },
  };
};

/** The class of armour's own throw-off where a blow lands (`hit`). */
const hit: ActionFxFn = (e, k) => {
  const where = typeof e.params.where === 'string' ? e.params.where : 'chest', a = k.mat.armour(e.pose, where), n = num(e.params.n, HIT_PUFF);
  const out = e.way ? { x: e.way.x, y: e.way.y } : undefined, h = out && Math.hypot(out.x, out.y) > 1e-6 ? { x: out.x / Math.hypot(out.x, out.y), y: out.y / Math.hypot(out.x, out.y) } : undefined;
  if (a.cls === 'plate' || a.cls === 'scale') {
    const m = k.mat.metal(a.piece), lit = a.cls === 'scale' && !(a.piece?.material && isMetalTone(a.piece.material)) ? k.mat.scale() : m.lit;
    k.burst(e.at, n, { kind: 'spark', colour: [lit, m.blade, WHITE], size: 1.5, life: [0.12, 0.26], speed: [0.2, 0.6], up: [4, 16], gravity: 70, drag: 0.2, heading: h, cone: 1.8, over: true, jitterZ: 0.3 });
    return { secs: GLINT_SECS, draw: (kk, u) => kk.flare(e.at, 3.5 * (1 - 0.4 * u), (1 - u) * 0.85, '#ffffff', 0.4, lit, true) };
  }
  if (a.cls === 'chain') {
    const m = k.mat.metal(a.piece);
    k.burst(e.at, n, { kind: 'mote', colour: [m.lit, '#ffffff'], size: 1.1, life: [0.12, 0.26], speed: [0.06, 0.2], up: [1, 5], gravity: 0, drag: 0.4, heading: h, cone: 2.4, jitter: 0.02, jitterZ: 0.8, over: true });
    k.burst(e.at, 2, { kind: 'spark', colour: [m.lit, WHITE], size: 1, life: [0.08, 0.16], speed: [0.2, 0.4], up: [4, 10], gravity: 60, heading: h, cone: 1.6, over: true, small: true });
    return;
  }
  if (a.cls === 'leather') {
    k.burst(e.at, Math.ceil(n / 2), { kind: 'dust', colour: mixHex(LEATHER_DUST, k.mat.dye(a.piece) ?? LEATHER_DUST, 0.3), size: 1.6, sizeEnd: 4.5, life: [0.3, 0.5], speed: [0.05, 0.16], up: [0, 3], gravity: -2, drag: 0.3, heading: h, cone: 2 });
    return;
  }
  // cloth, or nothing worn there: fluff drifting down, in the cloth's dye
  const c = k.mat.dye(a.piece) ?? FLUFF;
  k.burst(e.at, n, { kind: 'mote', colour: [c, mixHex(c, '#ffffff', 0.5)], size: 1, life: [0.45, 0.8], speed: [0.04, 0.14], up: [1, 4], gravity: 6, drag: 0.15, heading: h, cone: 2.6, jitter: 0.02, jitterZ: 1, over: true });
};

const heavy: ActionFxFn = (e, k) => {
  // (only a blow struck in a fight: mining's swing has its chips, `./strikes.ts`)
  if (e.pose?.job !== 'attack_creature') return;
  const g = k.mat.ground(e.at.x, e.at.y), at: P3 = k.on(e.at.x, e.at.y, 0.5);
  k.burst(at, num(e.params.n, SHOCK_DUST), { kind: 'dust', colour: [g.dust, shadeHex(g.dust, 0.9)], size: 2, sizeEnd: 6, life: [0.35, 0.55], speed: [SHOCK_REACH / 0.55 * 0.8, SHOCK_REACH / 0.55], up: [1, 3], gravity: -1, drag: 0.2, jitter: 0.03 });
  // the crack, on stone: a few jagged lines out from the blow, made once
  const cracks: number[][] = [];
  if (g.stony) {
    const arms = 3 + Math.floor(k.rand() * 2);
    for (let i = 0; i < arms; i++) {
      let a = (i / arms) * Math.PI * 2 + k.rand() * 0.8, x = at.x, y = at.y;
      const line = [x, y];
      for (let j = 0; j < 3; j++) { a += (k.rand() - 0.5) * 0.9; const d = 0.05 + k.rand() * 0.06; x += Math.cos(a) * d; y += Math.sin(a) * d; line.push(x, y); }
      cracks.push(line);
    }
  }
  const ink = shadeHex(g.colour, 0.42);
  return {
    secs: g.stony ? CRACK_SECS : SHOCK_SECS,
    draw: (kk, u) => {
      const s = (u * (g.stony ? CRACK_SECS : SHOCK_SECS)) / SHOCK_SECS;
      if (s < 1) kk.ring(at, 0.12 + (SHOCK_REACH - 0.12) * Math.sqrt(s), { band: 0.06 + 0.06 * (1 - s), main: g.dust, deep: shadeHex(g.dust, 0.85), ink: g.dust, alpha: 0.45 * (1 - s), glow: 0 });
      if (cracks.length) kk.groundShape(at.x, at.y, 0.5, [{ kind: 'stroke', colour: ink, alpha: 0.8 * (1 - u) * (1 - u), width: Math.max(0.8, 0.45 * kk.zoom), paths: cracks, join: 'round', lift: 0.1 }]);
    },
  };
};

/** A unit step in the world from `b` to `a` in tenths of a metre (x, y in tiles scaled up; z height units). */
function wayOf(a: P3, b: P3): P3 | null {
  const x = (a.x - b.x) * UNITS_PER_TILE, y = (a.y - b.y) * UNITS_PER_TILE, z = a.z - b.z, l = Math.hypot(x, y, z);
  return l > 1e-4 ? { x: x / l, y: y / l, z: z / l } : null;
}
/** `p` moved `d` tenths of a metre along a unit step `w` (`wayOf`). */
const go = (p: P3, w: P3, d: number): P3 => ({ x: p.x + (w.x * d) / UNITS_PER_TILE, y: p.y + (w.y * d) / UNITS_PER_TILE, z: p.z + w.z * d });

const twang: ActionFxFn = (e) => {
  const a = e.at, b = e.to;
  if (!b) return;
  return {
    secs: TWANG_SECS,
    draw: (kk, u) => {
      const x0 = kk.sx(a), y0 = kk.sy(a), x1 = kk.sx(b), y1 = kk.sy(b), dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
      // the string's swing, a standing wave dying away: two lines either side, as a string in motion is seen
      const amp = 1.4 * kk.zoom * (1 - u) * (1 - u) * Math.abs(Math.cos(u * TWANG_SECS * 2 * Math.PI * 24)), nx = -dy / l, ny = dx / l;
      kk.glowDraw((c) => {
        c.globalAlpha = 0.55 * (1 - u);
        c.strokeStyle = '#fff3d8';
        c.lineWidth = Math.max(0.6, 0.3 * kk.zoom);
        for (const s of [1, -1]) {
          c.beginPath();
          for (let i = 0; i <= 8; i++) {
            const w = i / 8, o = s * amp * Math.sin(Math.PI * w);
            const px = x0 + dx * w + nx * o, py = y0 + dy * w + ny * o;
            if (i) c.lineTo(px, py);
            else c.moveTo(px, py);
          }
          c.stroke();
        }
      });
    },
  };
};

const loose: ActionFxFn = (e, k) => {
  // from the nock (`to`, the drawing fist) through the arrow's rest (`at`): the way it flies
  const w = e.to ? wayOf(e.at, e.to) : null;
  if (!w) return;
  const reach = STREAK_TILES * UNITS_PER_TILE, piece = k.mat.piece(e.pose, e.held), lit = !!piece?.enchanted;
  if (lit) {
    // a spiral of gold motes round the line, each left where it is made
    const up: P3 = Math.abs(w.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    const p1 = norm(cross(w, up)), p2 = cross(w, p1), n = num(e.params.n, SPIRAL_MOTES);
    for (let i = 0; i < n; i++) {
      const d = (i / n) * reach * 0.8, th = i * 1.3, r = 1.8;
      const p = go(go(go(e.at, w, d), p1, Math.cos(th) * r), p2, Math.sin(th) * r);
      k.burst(p, 1, { kind: 'mote', colour: GOLD, size: 1.3, life: [0.25 + (0.25 * i) / n, 0.3 + (0.25 * i) / n], speed: [0, 0.02], up: [0, 1], gravity: 0, drag: 0.5, jitter: 0, jitterZ: 0, over: true });
    }
  }
  return {
    secs: STREAK_SECS,
    draw: (kk, u) => {
      const head = go(e.at, w, reach * Math.min(1, u * 1.5)), tail = go(e.at, w, reach * Math.max(0, u * 1.5 - 0.6));
      const x0 = kk.sx(tail), y0 = kk.sy(tail), x1 = kk.sx(head), y1 = kk.sy(head);
      kk.glowDraw((c) => {
        const gr = c.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, 'rgba(255,248,230,0)');
        gr.addColorStop(1, lit ? 'rgba(255,220,140,0.6)' : 'rgba(255,248,230,0.45)');
        c.globalAlpha = 1 - u;
        c.strokeStyle = gr;
        c.lineWidth = Math.max(0.7, 0.35 * kk.zoom);
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
      });
    },
  };
};

const runes: ActionFxFn = (e, k) => {
  if (e.pose?.job !== 'attack_creature' || !k.mat.piece(e.pose, e.held)?.enchanted) return;
  k.burst(e.at, 1, { kind: 'mote', colour: GOLD, size: 1.4, life: [0.35, 0.55], speed: [0.03, 0.1], up: [1, 4], gravity: -2, drag: 0.4, over: true, small: true });
  const turn = k.rand() * Math.PI, rise = 2 + k.rand() * 2;
  return {
    secs: RUNE_SECS,
    draw: (kk, u) => kk.mark({ x: e.at.x, y: e.at.y, z: e.at.z + rise * u }, { r: 1.6, points: 4, turn: turn + u * 4, main: GOLDS.main, core: GOLDS.core, ink: GOLDS.deep, alpha: (1 - u) * Math.min(1, u * 6), bias: 4 }),
  };
};

function cross(a: P3, b: P3): P3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function norm(a: P3): P3 {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}
export const COMBAT_FX: Readonly<Record<string, ActionFxFn>> = { block, hit, heavy, twang, loose, runes };
