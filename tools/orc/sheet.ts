/**
 * Sheets of the orc proposals (`src/render/wild-orc.ts`) beside the orc on
 * the island and the kinds round it, drawn by the game's own beast renderer:
 * at the island's zoom as the island puts them down (`drawBeast`, kept
 * pictures and all), close up (`drawKind`), by day and under the night's wash.
 *
 *   node tools/orc/shot.mjs out.png A       # one proposal's whole sheet
 *   node tools/orc/shot.mjs out.png lineup  # every orc beside the goblin, the ogre and three wildermon
 *   node tools/orc/shot.mjs out.png close:A # one proposal close up
 *   node tools/orc/shot.mjs - bench         # drawing cost of each orc, printed
 *
 * The page is given `window.SPEC`: sections, each a title and rows of cells. A
 * cell is one body (`who`: `A`, `B`, `C`, `orc`, a species, `species@stage`,
 * or `person`) or a `lineup` of them side by side, at the island's zoom
 * (`mode: 'game'`, at `zoom`) or close up (`mode: 'close'`, at `k` pixels a
 * unit), posed `stand` (at `t`), `walk:<u>`, `run:<u>` or `strike:<t>`.
 */
import { loadWildermon, wildermonKind } from '../../src/render/wildermon';
import { SPECIES } from '../../src/game/creatures';
import { beastFrame, beastsKept, forgetBeast, drawBeast, drawKind, kitOf, paletteFor, strideRate, type Anim, type Kind } from '../../src/render/beasts';
import { drawFigure, mesh } from '../../src/render/figure';
import { NIGHT_WASH } from '../../src/render/nightwash';
import { ORC_PROPOSALS } from '../../src/render/wild-orc';

interface Body { who: string; facing?: number; pose?: string; t?: number; dx?: number; variant?: number }
interface Cell extends Body { mode?: 'game' | 'close'; zoom?: number; k?: number; night?: boolean; w?: number; h?: number; label?: string; lineup?: Body[] }
interface Section { title: string; rows: Cell[][] }
interface Spec { sections: Section[]; bench?: { who: string[]; n: number; frames: number } }

const W = window as unknown as { SPEC: Spec; DONE: boolean; BENCH: unknown };
const spec = W.SPEC;

/** The orcs' own variants, which the proposals are coloured from. */
const colorsOf = (species: string, v = 0): [string, string] => SPECIES[species].variants[v] as [string, string];

/** The kind a cell names, the name its pictures are kept under, and its colours. */
function kindOf(who: string, v = 0): { kind: Kind; key: string; colors: [string, string] } | null {
  if (who in ORC_PROPOSALS) return { kind: ORC_PROPOSALS[who], key: `orc${who}`, colors: colorsOf('orc', v) };
  const [species, st] = who.split('@');
  const m = wildermonKind(species, Number(st ?? 0));
  return m ? { kind: m.kind, key: m.key, colors: colorsOf(species, v) } : null;
}

const realNow = performance.now.bind(performance);
/** The island's clock as `drawBeast` reads it, set so a body with no id is `t` seconds into its loop (`animOf`). */
function clockAt(t: number): void {
  const now = ((((t - 0.37 * 97) % 24) + 24) % 24) + 48;
  performance.now = () => now * 1000;
}

function poseOf(p = 'stand'): { go: number; gait: number; u: number; act?: { kind: 'strike'; t: number } } {
  const [k, v] = p.split(':');
  const x = Number(v ?? 0);
  if (k === 'walk') return { go: 1, gait: 0, u: x };
  if (k === 'run') return { go: 1, gait: 1, u: x };
  if (k === 'strike') return { go: 0, gait: 0, u: 0, act: { kind: 'strike', t: x } };
  // Striking on the move, the stride where `tools/orc/clip.ts` has it at that moment of the strike.
  if (k === 'walk-strike' || k === 'run-strike') return { go: 1, gait: k === 'run-strike' ? 1 : 0, u: (x * 50) / 37, act: { kind: 'strike', t: x } };
  return { go: 0, gait: 0, u: 0 };
}

/** A body at the island's zoom, feet at (x, y), put down the way the island puts it down. */
function gameBody(g: CanvasRenderingContext2D, b: Body, x: number, y: number, zoom: number): void {
  if (b.who === 'person') {
    clockAt(b.t ?? 0);
    drawFigure(g, x, y, zoom, { phase: 0, moving: false, facing: b.facing ?? 1, swimming: false, working: false });
    return;
  }
  const m = kindOf(b.who, b.variant);
  if (!m) return;
  const p = poseOf(b.pose);
  clockAt(b.t ?? 0);
  beastFrame();
  const phase = p.go ? p.u / strideRate(m.kind, p.gait) : 0;
  drawBeast(g, x, y, zoom, m.key, m.kind, m.colors, { facing: b.facing ?? 1, phase, moving: p.go > 0, gait: p.gait, act: p.act });
}

/** A body close up, `k` pixels to its unit, feet at (x, y). */
function closeBody(g: CanvasRenderingContext2D, b: Body, x: number, y: number, k: number): void {
  const m = kindOf(b.who, b.variant);
  if (!m) return;
  const p = poseOf(b.pose);
  const a: Anim = { t: b.t ?? 0, u: p.u, go: p.go, gait: p.gait, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0.3, act: p.act };
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  drawKind(g, m.kind, kitOf(m.key, m.kind, 1), paletteFor(m.key, m.kind, m.colors), b.facing ?? 1, a, 1.3 / k, 1 / k);
  g.restore();
}

/** The grass, with the island's tile diamonds on it at `zoom`, a corner of one under the feet at (w / 2, gy). */
function ground(g: CanvasRenderingContext2D, w: number, h: number, zoom: number, gy: number): void {
  g.fillStyle = '#7d9b5e';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(58,86,48,0.3)';
  g.lineWidth = 1;
  const step = 96 * zoom, x0 = w / 2;
  g.beginPath();
  // The lines y - gy = +-(x - x0 - c) / 2, a tile apart.
  for (let c = -Math.ceil((w + 2 * h) / step) * step; c <= w + 2 * h; c += step) {
    g.moveTo(0, gy + (0 - x0 - c) / 2);
    g.lineTo(w, gy + (w - x0 - c) / 2);
    g.moveTo(0, gy - (0 - x0 - c) / 2);
    g.lineTo(w, gy - (w - x0 - c) / 2);
  }
  g.stroke();
}

function drawCell(cell: Cell): HTMLElement {
  const w = cell.w ?? 120, h = cell.h ?? 140;
  const dpr = window.devicePixelRatio || 1;
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const g = cv.getContext('2d')!;
  g.scale(dpr, dpr);
  const gy = h * 0.92;
  const zoom = cell.zoom ?? 1;
  ground(g, w, h, cell.mode === 'close' ? 3 : zoom, gy);
  try {
    const bodies = cell.lineup ?? [cell];
    for (const b of bodies) {
      const x = w / 2 + (b.dx ?? 0);
      if (cell.mode === 'close') closeBody(g, b, x, gy, cell.k ?? 40);
      else gameBody(g, b, x, gy, zoom);
    }
  } catch (e) {
    g.fillStyle = 'red';
    g.font = '10px sans-serif';
    g.fillText(String(e).slice(0, 60), 4, 20);
    console.error(e);
  }
  performance.now = realNow;
  if (cell.night) {
    g.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha})`;
    g.fillRect(0, 0, w, h);
  }
  const box = document.createElement('div');
  box.className = 'cell';
  box.append(cv);
  if (cell.label !== undefined) {
    const l = document.createElement('div');
    l.textContent = cell.label;
    box.append(l);
  }
  return box;
}

/** How long each orc takes to draw: a body afresh (what a new picture costs), and a crowd on the move, striking, every frame. */
function bench(b: NonNullable<Spec['bench']>): unknown {
  const cv = document.createElement('canvas');
  cv.width = 1600;
  cv.height = 900;
  const g = cv.getContext('2d')!;
  const out: Record<string, unknown> = {};
  for (const who of b.who) {
    const [base, how] = who.split('-'), m0 = kindOf(base)!;
    // `-bare`: without what it draws by hand over its body (its runes' light, a blow's sweep); `-plain`: without anything painted
    // on it (its runes, eyes, rivets); to see what those cost.
    const m = how === 'bare' ? { ...m0, key: `${m0.key}-bare`, kind: { ...m0.kind, extra: undefined } }
      : how === 'plain' ? { ...m0, key: `${m0.key}-plain`, kind: { ...m0.kind, build: (lod: number) => m0.kind.build(lod).map((pc) => ({ ...pc, mesh: mesh(pc.mesh.v, pc.mesh.f.filter((f) => !f.decal)) })) } }
      : m0;
    const kit = kitOf(m.key, m.kind, 1), pal = paletteFor(m.key, m.kind, m.colors);
    const faces = kit.reduce((s, pc) => s + pc.mesh.f.length, 0);
    const step = 16 * 2;
    // Warm up.
    for (let q = 0; q < 20; q++) drawKind(g, m.kind, kit, pal, q % 8, { t: q, u: q * 0.1, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 }, 1.1 / step, 1 / step);
    // One body afresh at the island's zoom on a screen of two pixels to the point, over a spread of facings and moments.
    const per: number[] = [];
    for (let rep = 0; rep < 3; rep++) {
      const t0 = realNow();
      for (let q = 0; q < b.n; q++) {
        g.setTransform(step, 0, 0, step, 100 + (q % 10) * 140, 300);
        const a: Anim = { t: q * 0.37, u: q * 0.13, go: q % 3 === 0 ? 1 : 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0, act: q % 3 === 1 ? { kind: 'strike', t: (q % 11) / 11 } : undefined };
        drawKind(g, m.kind, kit, pal, q % 8, a, 1.1 / step, 1 / step);
      }
      g.getImageData(0, 0, 1, 1);
      per.push((realNow() - t0) / b.n);
    }
    // A crowd of twenty walking and striking on the move (drawn afresh every frame, as the island does), for `frames` frames.
    const crowd: number[] = [];
    for (let f = 0; f < b.frames; f++) {
      const t0 = realNow();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      for (let q = 0; q < 20; q++) {
        g.setTransform(step, 0, 0, step, 80 + (q % 10) * 150, 300 + Math.floor(q / 10) * 300);
        const a: Anim = { t: f / 60 + q, u: f / 40 + q * 0.1, go: 1, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0, act: { kind: 'strike', t: ((f / 33 + q * 0.07) % 1) } };
        drawKind(g, m.kind, kit, pal, q % 8, a, 1.1 / step, 1 / step);
      }
      g.getImageData(0, 0, 1, 1);
      crowd.push(realNow() - t0);
    }
    crowd.sort((x, y) => x - y);
    per.sort((x, y) => x - y);
    // And as the island draws them: twelve through `drawBeast`, kept as pictures, each frame given its allowance for new ones
    // (`beastFrame`), at zoom 0.6 on a screen of two pixels to the point, over 180 frames (three seconds) from nothing kept: all
    // walking about; all standing about; and all standing, a quarter of them striking over and over (kept as pictures too).
    const island = (mode: 0 | 1 | 2): Record<string, number> => {
      const striking = mode === 2;
      const game: number[] = [];
      let t = 1000 + mode * 1000;
      for (let f = 0; f < 180; f++) {
        t += 1 / 60;
        performance.now = () => t * 1000;
        const t0 = realNow();
        g.setTransform(2, 0, 0, 2, 0, 0);
        g.clearRect(0, 0, 800, 450);
        beastFrame();
        for (let q = 0; q < 12; q++) {
          const act = striking && q % 4 === 0 ? { kind: 'strike' as const, t: (t * 1.8 + q * 0.13) % 1 } : undefined;
          drawBeast(g, 60 + (q % 10) * 75, 200 + Math.floor(q / 10) * 200, 0.6, `${m.key}${mode}`, m.kind, m.colors, { id: `${who}${mode}${q}`, facing: q % 8, phase: t * 3 + q * 0.37, moving: mode === 0, act });
        }
        g.getImageData(0, 0, 1, 1);
        game.push(realNow() - t0);
      }
      performance.now = realNow;
      const warm = game.slice(60).sort((x, y) => x - y);
      const kept = beastsKept();
      // Let go, so the next run, or the next kind, starts from nothing kept and is not squeezed by this one's pictures.
      forgetBeast(`${m.key}${mode}`, m.kind);
      return { firstSecondMs: +(game.slice(0, 60).reduce((s2, x) => s2 + x, 0) / 60).toFixed(2), medianMs: +warm[warm.length >> 1].toFixed(2), p90Ms: +warm[Math.floor(warm.length * 0.9)].toFixed(2), kept: kept.frames, keptPx: kept.framePixels };
    };
    out[who] = {
      faces, pieces: kit.length, msPerBody: +per[1].toFixed(3), crowd20msPerFrame: +crowd[Math.floor(crowd.length / 2)].toFixed(2),
      island12walking: island(0), island12standing: island(1), island12fighting: island(2),
    };
  }
  return out;
}

const root = document.getElementById('root')!;
const wanted = new Set<string>(['orc', 'goblin', 'ogre']);
for (const s of spec.sections) for (const row of s.rows) for (const c of row) for (const b of c.lineup ?? [c]) if (!(b.who in ORC_PROPOSALS) && b.who !== 'person') wanted.add(b.who.split('@')[0]);
void Promise.all([...wanted].map((s) => loadWildermon(s))).then(() => {
  if (spec.bench) {
    W.BENCH = bench(spec.bench);
    W.DONE = true;
    return;
  }
  for (const s of spec.sections) {
    const t = document.createElement('div');
    t.className = 'title';
    t.textContent = s.title;
    root.append(t);
    for (const row of s.rows) {
      const line = document.createElement('div');
      line.className = 'row';
      for (const c of row) line.append(drawCell(c));
      root.append(line);
    }
  }
  W.DONE = true;
});
