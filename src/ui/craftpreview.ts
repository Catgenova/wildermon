/**
 * The crafting window's preview (`craft.ts`): what the recipe selected or pointed at makes, drawn as the island draws
 * it, in the material the row is set to.
 *
 * Which things have one is read off the models (`previewOf`), never listed: a piece with a model of its own
 * (`pieceModelled`; a smelter, a kiln, a work post, a settlement's stake and a trap as the renderer draws them set
 * down) as it stands set down, turning, by day; a cart, a wagon or a hull the same (`isDriveable`); a piece a body
 * wears that the figure draws (`gearModelled`) on your own figure in your look with nothing else on; a weapon in its
 * hand, in a fight; a tool the figure works with (`CLIP_OF_TOOL`) at a job that uses it; and anything else a body
 * holds that has a model of its own (`propModelled`: a loaf, a candle, a lantern) alone, turning. Anything else has
 * none, and the pane shows its empty state (`empty`).
 *
 * A piece set down is shown at each of its stages in turn (`stagesOf`), `STAGE_SECS` each, as it turns: what its
 * drawing is given that changes how it looks, found by drawing it -- its trim at every age from set down to two
 * months on (a hedge filling out, a bed's flowers, an arch's roses, a bonsai), lit and unlit, a lantern post with
 * its lantern in it, and a station's look turned on one flag at a time (a smelter lit, then working; a trap baited,
 * then sprung) or a settlement stake's levels -- each kept only where it draws differently from the one before.
 *
 * One small canvas, sized when its box is laid out (`fit`, on a `ResizeObserver`) and never per frame. Each frame is
 * drawn on a canvas of its own (`buf`) and put on the one on the page only once something is drawn on it, so the
 * last picture stays up until the next is ready, and nothing blank is ever shown between two pictures. Drawn only
 * while the window is open and a recipe with a preview is chosen, at most `PREVIEW_FPS` frames a second and never
 * more than a `PREVIEW_SHARE`th of the page's time (as the Path card's, `pathpreview.ts`). A still frame of the last
 * stage with Animations off, with less motion, where bodies are drawn by the processor (`sculptSoft`) and where they
 * are drawn flat (`flatFigures`): drawn a few times while what it is drawn of lands, then not again.
 */
import { ACTIONS } from '../game/actions';
import { capital } from '../game/words';
import { furnitureDef, isDriveable, isFurniture, isPlanter, rackSpots, type PlacedFurniture } from '../game/furniture';
import type { Game } from '../game/game';
import { slotOf } from '../game/gear';
import { itemDef } from '../game/items';
import { isLampPiece } from '../game/lamps';
import { DEFAULT_LOOK } from '../game/look';
import { materialOf } from '../game/materials';
import { MEMORIAL } from '../game/memorial';
import { mossyPiece } from '../game/greening';
import { roseStage } from '../game/roses';
import { bloomStage } from '../game/garden';
import { MAX_DEED_LEVEL } from '../game/deedsize';
import { DAY_SECONDS } from '../game/pace';
import { isRuneLantern } from '../game/runelantern';
import { isTrellis, vineStage } from '../game/vineyard';
import type { RugPattern } from '../game/decordefs';
import type { GearLook, GearPiece, GearSlot } from '../contract/gear';
import { animationsOff, lessMotion, setAnimations } from '../engine/motion';
import { drawFigure, drawPropAlone, figureJoint, flatFigures, gearModelled, onScreen, propModelled, sculptSoft, viewOf, type FigurePose, type V3 } from '../render/figure';
import { drawWorkPost } from '../render/workpost';
import { drawDeedTotem } from '../render/deedtotem';
import { drawTrap } from '../render/sprites';
import { TRAPS } from '../game/trapdefs';
import { drawFurniture, mossTrim, pieceModelled, pieceView, roseTrim, rowedPiece, vineTrim, WHEELS } from '../render/furniture';
import { kitIsSync, kitSync, layKitModel } from '../render/kitpieces';
import { storeCrateModel } from '../render/kit/storecrate';
import { eyeOf } from '../render/runestone';
import { CRATE_DEFS, type CrateKind } from '../game/crates';
import { drawKiln, drawSmelter, type KilnLook, type SmelterLook } from '../render/forge';
import { drawMemorial } from '../render/memorial';
import { drawRuneLantern } from '../render/runelantern';
import { gardenTrim } from '../render/gardenlook';
import { decorTrim } from '../render/decorlook';
import { furnishTrim } from '../render/furnishlook';
import { fittingTrim } from '../render/fittinglook';
import { adornTrim } from '../render/adornlook';
import { CLIP_OF_TOOL, clipOfJob } from '../sculpt/anim/routes';

/** What a preview draws: a piece set down, a hull or a vehicle, a piece worn, a thing held, or a thing's own model alone. */
export type PreviewKind = 'furniture' | 'vehicle' | 'gear' | 'held' | 'model';

type Box = [number, number, number, number];
/** A look a station's drawing takes: its own flags and numbers. */
type Look = Record<string, unknown>;

/**
 * One stage a thing is shown at: what its drawing is given -- a piece's trim and whether it is lit, or a station's
 * look -- and the island's word for it, where it has one.
 */
export interface Stage {
  name?: string;
  trim?: number;
  lit?: boolean;
  look?: Look;
}

/**
 * A look's flags turned on one after another from all off, as its drawing reads them: the stages a station is drawn
 * at, named by the flag (`base` names the first, all off). A smelter: unlit, lit, working.
 */
const flips = (look: Look, base: string): Stage[] => {
  const out: Stage[] = [{ name: base, look }];
  let at = look;
  for (const [k, v] of Object.entries(look)) {
    if (v !== false) continue;
    at = { ...at, [k]: true };
    out.push({ name: k, look: at });
  }
  return out;
};

/** How a thing set down that is not furniture is drawn, and the stages it is drawn at. */
interface SetDown {
  draw: (g: CanvasRenderingContext2D, x: number, y: number, zoom: number, turn: number, material: string | undefined, look: Look, t: number) => Box;
  stages: Stage[];
}
const SMELTER_LOOK: SmelterLook = { lit: false, working: false };
const KILN_LOOK: KilnLook = { lit: false, firing: false };
const POST_LOOK = { worked: false };
const TRAP_LOOK = { baited: false, sprung: false };
/**
 * What is set down that is not furniture, by its item, and how each is drawn as the renderer draws it set down: the
 * smelter and the kiln (`forge.ts`), a work post (`workpost.ts`), the settlement's stake as the token it stands as
 * (`deedtotem.ts`, a block for each level), the traps (`drawTrap`), and the crates in the wood they are made of
 * (`kit/storecrate.ts`).
 */
const STATIONS: Record<string, SetDown> = {
  smelter: { draw: (g, x, y, zoom, turn, _m, look, t) => drawSmelter(g, x, y, zoom, turn, { ...SMELTER_LOOK, ...look }, 0, t, false), stages: flips({ ...SMELTER_LOOK }, 'unlit') },
  kiln: { draw: (g, x, y, zoom, turn, _m, look, t) => drawKiln(g, x, y, zoom, turn, { ...KILN_LOOK, ...look }, 0, t, false), stages: flips({ ...KILN_LOOK }, 'unlit') },
  work_post: {
    draw: (g, x, y, zoom, turn, material, look, t) => drawWorkPost(g, x, y, zoom, { wood: material, left: 1, variant: 0, ...POST_LOOK, ...look }, turn, 0, t, false),
    stages: flips({ ...POST_LOOK }, 'idle'),
  },
  deed_stake: {
    draw: (g, x, y, zoom, turn, _m, look, t) => drawDeedTotem(g, x, y, zoom, { level: 1, variant: 0, ...look }, turn, 0, t, false),
    stages: Array.from({ length: MAX_DEED_LEVEL }, (_, i) => ({ name: `level ${i + 1}`, look: { level: i + 1 } })),
  },
  ...Object.fromEntries((Object.keys(CRATE_DEFS) as CrateKind[]).map((kind): [string, SetDown] => [CRATE_DEFS[kind].item, {
    draw: (g, x, y, zoom, turn, material) => {
      const m = storeCrateModel(kind, material);
      const e = eyeOf(0, turn);
      g.save();
      g.translate(x, y);
      g.scale(zoom, zoom);
      const { hit } = layKitModel(g, m, e);
      g.restore();
      return hit.map((v) => v * zoom) as Box;
    },
    stages: [{}],
  }])),
  ...Object.fromEntries(Object.keys(TRAPS).map((kind): [string, SetDown] => [kind, {
    draw: (g, x, y, zoom, _turn, _m, look) => {
      drawTrap(g, x, y, zoom, kind, !!look.baited, !!look.sprung);
      return [0, 0, 0, 0];
    },
    stages: flips({ ...TRAP_LOOK }, 'set'),
  }])),
};

/** Whether a thing is set down without being furniture (a station, a work post, a stake, a trap): drawn as the renderer draws it set down. */
export const setDownPiece = (id: string): boolean => !!STATIONS[id];

/** The island's fight (`creatureActions.ts`): the job a body holds its weapon out at (`heldIn`). */
const FIGHT_JOB = 'attack_creature';
/** The places on a body a piece is drawn worn (`gearFrom` draws no more). */
const WORN: ReadonlySet<string> = new Set<GearSlot>(['head', 'chest', 'shawl', 'legs', 'feet', 'belt', 'jewel', 'offhand']);

/** A job done with a tool that the figure holds at it (`CLIP_OF_TOOL`), the job's own clip being the tool's: the first such action. */
const TOOL_JOB = new Map<string, string>();
for (const a of ACTIONS) {
  const t = a.tool;
  if (t === undefined || TOOL_JOB.has(t) || !CLIP_OF_TOOL[t] || clipOfJob(a.id) !== CLIP_OF_TOOL[t] || !(a.baseTime > 0)) continue;
  TOOL_JOB.set(t, a.id);
}

/** What kind of preview a thing made has, or null for none: read off what the island draws it by. */
export function previewOf(id: string): PreviewKind | null {
  if (setDownPiece(id)) return 'furniture';
  if (isFurniture(id)) return !pieceModelled(id) && id !== MEMORIAL && !isRuneLantern({ kind: id }) ? null : isDriveable({ kind: id }) || furnitureDef(id).cart ? 'vehicle' : 'furniture';
  const slot = slotOf(id);
  if (slot === 'weapon' && gearModelled(id)) return 'held';
  if (slot && WORN.has(slot) && gearModelled(id)) return 'gear';
  if (TOOL_JOB.has(id)) return 'held';
  // A thing a body holds at a job of its own (a loaf eaten, a candle carried, a lantern), alone: known once the sculpted bodies have loaded.
  if (propModelled(id)) return 'model';
  return null;
}

/** What a preview is of: the thing, the material its row is set to, and the choices a row makes of a few things. */
export interface PreviewOf {
  item: string;
  /** As an item names it (`Item.extra`): a wood, a metal, a stone, a pelt, a gem. */
  material?: string;
  /** A carved figure's or a plush's kind. */
  figure?: string;
  /** A woven rug's pattern. */
  pattern?: RugPattern;
}

/** The canvas, CSS pixels, by default; narrow, the thumbnail (the stylesheet says which, and the canvas follows it). */
export const PREVIEW_W = 136;
export const PREVIEW_H = 96;
/** The most frames a second it is drawn at, and the most of the page's time it takes (as the Path card's). */
export const PREVIEW_FPS = 24;
const PREVIEW_SHARE = 12;
/** Seconds each of the eight ways round is held before the next. */
export const TURN_SECS = 1.25;
/** Drawn still: this often while what it is drawn of lands, and for this long. */
const STILL_FPS = 4;
const STILL_FOR = 1.6;
/** Pixels left round a piece, and over the crown and under the feet of a body. */
const PAD = 6;
const ROOM_OVER = 8;
const ROOM_UNDER = 7;
/** The most a piece is drawn up to, device pixels to its own: its pictures are baked no finer (`BAKE_STEPS`). */
const MOST_ZOOM = 6;
/**
 * Where on the body a piece worn is framed, and how much closer than the whole body (as tall as the canvas): the
 * point on a bone (as the Equipment window points at a place), held at the canvas's middle. Small on the whole body,
 * a cap, a circlet or a jewel is framed closest; a thing held, the hands and what is in them.
 */
type Frame = [bone: string, at: V3, closer: number];
const FRAME_ON: Partial<Record<GearSlot, Frame>> = {
  head: ['head', [0, 0, 0.7], 2.2], jewel: ['neck', [0, 0, -0.4], 2.6], chest: ['chest', [0, 0, 0.5], 1.35], shawl: ['chest', [0, 0, 0.9], 1.45],
  belt: ['chest', [0, 0, -2.4], 1.9], legs: ['knee0', [0, 0, 0.6], 1.45], feet: ['ankle0', [0, 0, 0.4], 2.2], offhand: ['chest', [0, 0, -0.6], 1.45],
};
const FRAME_HELD: Frame = ['chest', [0, 0, -1.2], 1.05];
/** And a piece worn somewhere else than its place says: a ring, the hands (`lowring`). */
const FRAME_ON_ITEM: Record<string, Frame> = { jewelled_ring: ['chest', [0, 0, -1.8], 1.5] };
/** The scratch a piece is measured on, CSS pixels at zoom one, and where its floor contact is on it. */
const MEASURE = 640;
const MEASURE_AT: [number, number] = [320, 440];
/** The way a body faces when still, and the way a piece is seen when still: three-quarters on. */
const STILL_FACING = 1;
const STILL_TURN = 0;
/** The made-up piece a furniture preview reads its look off: one id, so what the look keeps by id is kept once. */
const PREVIEW_ID = -7;

/** Seconds each stage of a thing is held before the next (`stagesOf`). */
export const STAGE_SECS = 1.2;
/** The ages a piece's trim is read at for its stages, days after it is set down: every half day of two months. */
const AGES = Array.from({ length: 121 }, (_, i) => i / 2);
/** The most trims of those that are drawn to see which differ, and the most stages shown of those that do. */
const MOST_TRIED = 12;
const MOST_STAGES = 5;
/** The scratch two stages are told apart on, and where the floor contact is on it, at zoom one. */
const TELL = 256;
const TELL_AT: [number, number] = [128, 200];
/** Seconds a thing that draws nothing yet is waited for before the pane shows its empty state instead of the last picture. */
const GIVE_UP = 1.5;
/** The things whose stages and box are kept, the least lately shown let go past this. */
const KNOWN_KEPT = 24;

/** Whether a preview is drawn still: a harness on software GL that is there to see it move clears `stillOnSoft`. */
export const craftPreviewKnobs = { stillOnSoft: true };

/** A stage as the pane labels it: the island's word for it, or "Stage", and which of how many. */
export const stageLabel = (stage: Stage, k: number, n: number): string => `${stage.name ? capital(stage.name) : 'Stage'} ${k + 1}/${n}`;

/** A scratch canvas of a size, made once, cleared for each use. */
const scratches = new Map<number, CanvasRenderingContext2D | null>();
function scratch(size: number): CanvasRenderingContext2D | null {
  if (!scratches.has(size)) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    scratches.set(size, c.getContext('2d', { willReadFrequently: true }));
  }
  const g = scratches.get(size) ?? null;
  if (g) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, size, size);
  }
  return g;
}

/**
 * What a drawing covers, by its pixels, from the point it was drawn at on a scratch canvas: left, top, right, bottom;
 * the box it returns where it drew nothing (a bake not made yet); and whether it drew anything.
 */
function inkOf(draw: (g: CanvasRenderingContext2D, x: number, y: number) => Box): { box: Box; drawn: boolean } {
  const g = scratch(MEASURE);
  if (!g) return { box: [-20, -40, 20, 10], drawn: false };
  const [ax, ay] = MEASURE_AT;
  const hit = draw(g, ax, ay);
  const d = g.getImageData(0, 0, MEASURE, MEASURE).data;
  let l = MEASURE, t = MEASURE, r = -1, b = -1;
  for (let y = 0; y < MEASURE; y++) {
    for (let x = 0; x < MEASURE; x++) {
      if (d[(y * MEASURE + x) * 4 + 3] < 12) continue;
      if (x < l) l = x;
      if (x > r) r = x;
      if (y < t) t = y;
      b = y;
    }
  }
  // Nothing drawn (not baked yet): its box as its drawing returns it.
  return r < 0 ? { box: hit, drawn: false } : { box: [l - ax, t - ay, r + 1 - ax, b + 1 - ay], drawn: true };
}

/** A sum of a drawing's pixels at zoom one, to tell two stages apart by. */
function pictureSum(draw: (g: CanvasRenderingContext2D, x: number, y: number) => void): number {
  const g = scratch(TELL);
  if (!g) return 0;
  draw(g, TELL_AT[0], TELL_AT[1]);
  const d = g.getImageData(0, 0, TELL, TELL).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) sum = (sum * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11 + i) % 1000000007;
  return sum;
}

/** So many of a list, spread evenly along it, its first and its last kept. */
function thin<T>(list: T[], most: number): T[] {
  if (list.length <= most) return list;
  return Array.from({ length: most }, (_, k) => list[Math.round((k * (list.length - 1)) / (most - 1))]);
}

/** Whether any pixel of a canvas is drawn on. */
function inked(g: CanvasRenderingContext2D, w: number, h: number): boolean {
  if (!w || !h) return false;
  const d = g.getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return true;
  return false;
}

export class CraftPreview {
  /** The canvas on the page: only a whole picture is ever put on it, or the empty state. */
  readonly el: HTMLCanvasElement;
  /** Where each frame is drawn before it is put on `el`. */
  private readonly buf: HTMLCanvasElement;
  private what: PreviewOf | null = null;
  private kind: PreviewKind | null = null;
  private key = '';
  private frame = 0;
  private last = 0;
  private started = 0;
  /** Device pixels to a CSS pixel, as the canvas was last sized (`fit`). */
  private dpr = 1;
  /** Frames drawn since the page opened, and what the last cost, ms: for the tests. */
  frames = 0;
  cost = 0;
  /** Frames put on the page, and frames drawn with nothing on them that were not: for the tests. */
  shown = 0;
  held = 0;
  /** A still frame drawn for long enough: no more drawing until something changes. */
  private stillDone = false;
  /** A piece's box at zoom one across the ways and stages it is seen, left, top, right, bottom from its floor contact. */
  private box: Box | null = null;
  /** The stages it is shown at, in order (one, for a thing with none). */
  private stages: Stage[] = [];
  /** Whether a picture of what it shows now is on the page, and whether the empty state is. */
  private drawn = false;
  private blank = false;
  /** Stages and boxes worked out, by what was shown and whether still. */
  private readonly known = new Map<string, { stages: Stage[]; box: Box }>();
  /** Told the stage on the page whenever it changes: its label, or null for a thing with one stage or none. */
  onStage: ((label: string | null) => void) | null = null;
  /** The stage label on the page now. */
  stageSays: string | null = null;

  constructor(private readonly game: Game, private readonly open: () => boolean) {
    this.el = document.createElement('canvas');
    this.el.className = 'craft-preview-pic';
    this.el.width = PREVIEW_W;
    this.el.height = PREVIEW_H;
    this.el.setAttribute('role', 'img');
    this.buf = document.createElement('canvas');
    // Sized when its box is laid out, and again only when that changes; never by a frame (a canvas sized is a canvas cleared).
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.fit()).observe(this.el);
  }

  /** Whether it is drawn still. */
  get still(): boolean {
    return animationsOff() || lessMotion() || (craftPreviewKnobs.stillOnSoft && sculptSoft()) || flatFigures();
  }

  /** Whether it has a thing to show (drawing it, or done with a still frame of it). */
  get active(): boolean {
    return this.key !== '';
  }

  /** Whether its drawing is going. */
  get running(): boolean {
    return this.frame !== 0;
  }

  /** What it shows now, and of what kind. */
  get showing(): { what: PreviewOf; kind: PreviewKind } | null {
    return this.what && this.kind ? { what: this.what, kind: this.kind } : null;
  }

  /** How many stages what it shows is shown at. */
  get stageCount(): number {
    return this.stages.length;
  }

  /**
   * The canvas sized to its box as laid out, in device pixels, the picture on it kept across the change, scaled:
   * nothing is shown blank for a resize. A box not laid out (the window shut) leaves it as it is.
   */
  fit(): void {
    const c = this.el;
    const W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(W * dpr), h = Math.round(H * dpr);
    this.dpr = dpr;
    if (c.width === w && c.height === h) return;
    const keep = document.createElement('canvas');
    keep.width = c.width;
    keep.height = c.height;
    keep.getContext('2d')?.drawImage(c, 0, 0);
    c.width = w;
    c.height = h;
    if (this.blank || !this.key) this.empty();
    else {
      c.getContext('2d')?.drawImage(keep, 0, 0, w, h);
      // And a fresh frame at the new size where the drawing has stopped (a still frame).
      if (!this.frame) this.draw(Math.max(0, performance.now() - this.started) / 1000, this.still);
    }
  }

  /**
   * Show a thing, from the start; the empty state for a thing with no preview, or for none. The same thing asked
   * again goes on as it was. What is on the page stays there until the new thing has a picture.
   */
  show(what: PreviewOf | null): void {
    const kind = what ? previewOf(what.item) : null;
    const key = what && kind ? `${what.item}|${what.material ?? ''}|${what.figure ?? ''}|${what.pattern ?? ''}|${this.game.player.look ? JSON.stringify(this.game.player.look) : ''}` : '';
    if (key === this.key) {
      if (key) this.wake();
      else if (!this.blank) this.empty();
      return;
    }
    this.stop();
    this.what = kind ? what : null;
    this.kind = kind;
    this.box = null;
    this.stages = [];
    this.drawn = false;
    if (!kind || !what) {
      this.el.setAttribute('aria-label', what ? `${itemDef(what.item).name}: no preview` : 'No preview');
      this.empty();
      return;
    }
    this.key = key;
    this.el.setAttribute('aria-label', what.material ? `${itemDef(what.item).name}: ${capital(what.material.toLowerCase())}` : itemDef(what.item).name);
    this.started = performance.now();
    this.stillDone = false;
    this.loop();
  }

  /** Drawing again where it stopped short: moving again after a still frame, Animations turned back on. */
  wake(): void {
    if (this.key && !this.frame && !(this.still && this.stillDone)) {
      this.stillDone = false;
      // Its stages and box again: a still frame measures only the one stage it shows.
      this.box = null;
      this.started = performance.now();
      this.loop();
    }
  }

  private loop(): void {
    this.last = 0;
    const step = (ms: number): void => {
      if (!this.what || !this.open()) {
        this.frame = 0;
        return;
      }
      const still = this.still, t = Math.max(0, ms - this.started) / 1000;
      // Still, and drawn for long enough for what it is drawn of to have landed: no more.
      if (still && t >= STILL_FOR) {
        this.stillDone = true;
        this.frame = 0;
        return;
      }
      const gap = still ? 1000 / STILL_FPS : Math.max(1000 / PREVIEW_FPS, this.cost * PREVIEW_SHARE);
      if (ms - this.last >= gap) {
        this.last = ms;
        const t0 = performance.now();
        this.draw(t, still);
        this.frames++;
        this.cost = performance.now() - t0;
      }
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  /** Stop drawing and forget what it showed: the window is shut, or what it shows has changed. The picture stays on the page. */
  stop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.key = '';
  }

  /** A frame `t` seconds in, drawn now, moving or not (the tests' pictures of it turning). */
  drawAt(t: number, still = false): void {
    this.draw(t, still);
  }

  /** The stage label as it now stands, told on when it changes. */
  private sayStage(label: string | null): void {
    if (label === this.stageSays) return;
    this.stageSays = label;
    this.onStage?.(label);
  }

  /** The empty state: a faint box seen three-quarters on, in the pane's own ink, where a thing would stand. */
  private empty(): void {
    const c = this.el, g = c.getContext('2d');
    this.blank = true;
    this.drawn = false;
    this.sayStage(null);
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    const s = Math.min(c.width, c.height) * 0.24, x = c.width / 2, y = c.height / 2, dx = s * 0.87, dy = s * 0.5;
    g.globalAlpha = 0.3;
    g.strokeStyle = getComputedStyle(c).color || 'grey';
    g.lineWidth = Math.max(1, c.height / PREVIEW_H) * 1.25;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + dx, y - s + dy);
    g.lineTo(x + dx, y + dy);
    g.lineTo(x, y + s);
    g.lineTo(x - dx, y + dy);
    g.lineTo(x - dx, y - s + dy);
    g.closePath();
    g.moveTo(x - dx, y - s + dy);
    g.lineTo(x, y);
    g.lineTo(x + dx, y - s + dy);
    g.moveTo(x, y);
    g.lineTo(x, y + s);
    g.stroke();
    g.globalAlpha = 1;
  }

  /**
   * A frame, drawn on `buf` and put on the page only if anything was drawn on it: until what it shows has landed, the
   * last picture stays up (or, after `GIVE_UP` with none of this thing yet, the empty state).
   */
  private draw(t: number, still: boolean): void {
    const what = this.what, kind = this.kind;
    const c = this.el, b = this.buf;
    if (!what || !kind) return;
    if (b.width !== c.width || b.height !== c.height) {
      b.width = c.width;
      b.height = c.height;
    }
    const g = b.getContext('2d', { willReadFrequently: true });
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, b.width, b.height);
    const dpr = this.dpr, W = b.width, H = b.height;
    // One of the eight ways round, the next every `TURN_SECS`; and one of its stages, the next every `STAGE_SECS`.
    const turn = still ? STILL_TURN : Math.floor(t / TURN_SECS) % 8;
    let stage = -1;
    if (kind === 'furniture' || kind === 'vehicle') stage = this.drawPiece(g, what, turn, t, W, H, still);
    else if (kind === 'model') this.drawModel(g, what, still ? STILL_FACING : STILL_FACING + t / TURN_SECS, W, H, still);
    else this.drawBody(g, what, kind, still ? STILL_FACING : (STILL_FACING + turn) % 8, t, W / dpr, H / dpr, dpr, still);
    if (!inked(g, W, H)) {
      this.held++;
      if (!this.drawn && !this.blank && t >= GIVE_UP) this.empty();
      return;
    }
    const v = c.getContext('2d');
    if (!v) return;
    v.setTransform(1, 0, 0, 1, 0, 0);
    v.clearRect(0, 0, c.width, c.height);
    v.drawImage(b, 0, 0);
    this.shown++;
    this.drawn = true;
    this.blank = false;
    const n = this.stages.length;
    this.sayStage(n > 1 && stage >= 0 ? stageLabel(this.stages[stage], stage, n) : null);
  }

  /** Which of `n` stages is shown `t` seconds in: still, the last (the grown, the lit, the finished one). */
  private stageOf(t: number, n: number, still: boolean): number {
    return n <= 1 ? 0 : still ? n - 1 : Math.floor(t / STAGE_SECS) % n;
  }

  /**
   * The stages a piece set down is shown at: a station's from its look (`STATIONS`); a piece's from its trim at each
   * age from set down to two months on (`AGES`; a trellis first with no vine), a lantern post empty and with its
   * lantern in it (as the renderer reads it), and the last of those lit. Each kept only where its picture differs
   * from the one kept before it, and no more than `MOST_STAGES`, spread from the first to the last.
   */
  private stagesOf(what: PreviewOf): Stage[] {
    const station = STATIONS[what.item];
    const tried: Stage[] = [];
    if (station) tried.push(...station.stages);
    else if (what.item === MEMORIAL || isRuneLantern({ kind: what.item })) tried.push({});
    else if (isLampPiece({ kind: what.item })) tried.push({ name: 'empty', trim: 0 }, { trim: 1 });
    else {
      const now = this.game.wallNow(), def = furnitureDef(what.item);
      const trellis = isTrellis(this.placed(what, now, now));
      const add = (setAt: number, vineAt?: number): void => {
        const trim = this.trim(what, now, setAt, vineAt);
        if (tried.length && tried[tried.length - 1].trim === trim) return;
        const name = trellis ? vineStage({ vineAt, pickedAt: undefined }, now)
          : def.bloom ? bloomStage(setAt, now).stage : def.climber ? roseStage(setAt, now, def.climber).stage : undefined;
        tried.push({ trim, ...(name ? { name } : {}) });
      };
      for (const d of AGES) add(now - d * DAY_SECONDS, trellis && d > 0 ? now - d * DAY_SECONDS : undefined);
    }
    const list = station ? tried : thin(tried, MOST_TRIED);
    // And the last of them lit, for a piece whose drawing takes it (kept below only if it draws differently).
    if (!station && list.length) list.push({ ...list[list.length - 1], name: 'lit', lit: true });
    if (list.length <= 1) return list.length ? list : [{}];
    const kept: Stage[] = [];
    let was = -1;
    for (const st of list) {
      const sum = pictureSum((g, x, y) => this.piece(g, what, STILL_TURN, x, y, 1, st, 0));
      if (sum === was) continue;
      was = sum;
      kept.push(st);
    }
    // The one before a lit last is the same, unlit.
    const n = kept.length;
    if (n > 1 && kept[n - 1].lit && !kept[n - 2].name) kept[n - 2] = { ...kept[n - 2], name: 'unlit' };
    return thin(kept, MOST_STAGES);
  }

  /**
   * A piece set down, its floor contact placed so the whole of it, at every stage and way round it is seen, fills
   * the canvas: the stage drawn, of its stages.
   */
  private drawPiece(g: CanvasRenderingContext2D, what: PreviewOf, turn: number, t: number, W: number, H: number, still: boolean): number {
    // Each bake made when it is wanted, here only: the island's own frame share is not this canvas's.
    const was = kitIsSync();
    kitSync(true);
    try {
      if (!this.box) {
        const known = `${this.key}|${still ? 1 : 0}`;
        const got = this.known.get(known);
        if (got) {
          this.known.delete(known);
          this.known.set(known, got);
          this.stages = got.stages;
          this.box = got.box;
        } else {
          const stages = this.stagesOf(what);
          // Measured at zoom one by what it draws: moving, its last stage the ways it will be seen (four of the eight
          // and each mirrored: the other four are those seen from behind, as wide) and every other stage three-quarters
          // on; still, the one stage and way it is shown.
          let box: Box = [0, 0, 0, 0];
          let drawn = true;
          const take = (st: Stage, k: number): void => {
            const m = inkOf((sg, x, y) => this.piece(sg, what, k, x, y, 1, st, 0));
            drawn &&= m.drawn;
            const b = m.box;
            box = [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])];
          };
          if (still) take(stages[stages.length - 1], turn);
          else {
            stages.forEach((st, i) => (i === stages.length - 1 ? [0, 1, 2, 3] : [STILL_TURN]).forEach((k) => take(st, k)));
            box = [Math.min(box[0], -box[2]), box[1], Math.max(box[2], -box[0]), box[3]];
          }
          this.stages = stages;
          this.box = box;
          // Kept only once it has all landed, so a box measured off a bake not made yet is measured again.
          if (drawn) {
            this.known.set(known, { stages, box });
            if (this.known.size > KNOWN_KEPT) this.known.delete(this.known.keys().next().value as string);
          }
        }
      }
      const [l, tp, r, b] = this.box;
      const zoom = Math.min(MOST_ZOOM, (W - 2 * PAD) / Math.max(1, r - l), (H - 2 * PAD) / Math.max(1, b - tp));
      const sx = W / 2 - ((l + r) / 2) * zoom, sy = H / 2 - ((tp + b) / 2) * zoom;
      const k = this.stageOf(t, this.stages.length, still);
      this.piece(g, what, turn, sx, sy, zoom, this.stages[k] ?? {}, still ? 0 : t);
      return k;
    } finally {
      kitSync(was);
    }
  }

  /**
   * A thing's model alone (`drawPropAlone`), turning smoothly (any fraction of an eighth: it is drawn afresh each
   * frame, not baked), stood on its foot and filling the canvas.
   */
  private drawModel(g: CanvasRenderingContext2D, what: PreviewOf, facing: number, W: number, H: number, still: boolean): void {
    const material = materialOf(what.material)?.id;
    const piece: GearPiece = { id: what.item, ...(material ? { material } : {}) };
    if (!this.box) {
      // Its box from its own points (`drawPropAlone` with nothing to draw on), the ways round it is seen: every
      // sixteenth of a turn, or the one still.
      let box: Box | null = null;
      for (const f of still ? [facing] : Array.from({ length: 16 }, (_, k) => k / 2)) {
        const b = drawPropAlone(null, 0, 0, 1, piece, f, 1);
        if (b) box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
      }
      if (!box) return;
      this.box = box;
    }
    const [l, t, r, b] = this.box;
    const zoom = Math.min((W - 2 * PAD) / Math.max(0.1, r - l), (H - 2 * PAD) / Math.max(0.1, b - t));
    g.setTransform(1, 0, 0, 1, 0, 0);
    drawPropAlone(g, W / 2 - ((l + r) / 2) * zoom, H / 2 - ((t + b) / 2) * zoom, zoom, piece, facing, 1);
  }

  /**
   * One piece at a stage drawn with its floor contact at (sx, sy), as the placing ghost draws it (`drawGhost`), by
   * day, `t` seconds into what moves on it: its box, as its drawing returns it.
   */
  private piece(g: CanvasRenderingContext2D, what: PreviewOf, turn: number, sx: number, sy: number, zoom: number, stage: Stage, t: number): Box {
    const kind = what.item;
    const station = STATIONS[kind];
    if (station) return station.draw(g, sx, sy, zoom, turn, what.material, stage.look ?? {}, t);
    if (kind === MEMORIAL) return drawMemorial(g, sx, sy, zoom, 's', turn, undefined, 0, 0);
    if (isRuneLantern({ kind })) return drawRuneLantern(g, sx, sy, zoom, { facing: 's', stage: 0, stages: 1, variant: 0 }, turn, 0, 0, false);
    const trim = 'trim' in stage ? stage.trim : this.trim(what, this.game.wallNow(), this.game.wallNow());
    return drawFurniture(g, sx, sy, zoom, kind, !!stage.lit, undefined, trim, pieceView('s', turn), what.material);
  }

  /** The made-up piece a preview reads its look off: set down at `setAt`, its vine planted at `vineAt`, in its row's choices. */
  private placed(what: PreviewOf, now: number, setAt: number, vineAt?: number): PlacedFurniture {
    return {
      id: PREVIEW_ID, kind: what.item, x: 0, y: 0, sx: 0, sy: 0, facing: 's', ql: 1, items: [], material: what.material, setAt, vineAt,
      decor: what.pattern ? { pattern: what.pattern } : undefined, adorn: what.figure ? { plush: what.figure } : undefined, garden: what.figure ? { figure: what.figure } : undefined,
    } as unknown as PlacedFurniture;
  }

  /**
   * What a piece shows of what it holds or grows at `now`, set down at `setAt` (as the renderer reads it off a placed
   * piece, `pieceTrim`): nothing in it yet, in its pattern or kind.
   */
  private trim(what: PreviewOf, now: number, setAt: number, vineAt?: number): number | undefined {
    const f = this.placed(what, now, setAt, vineAt);
    if (WHEELS[f.kind] || rowedPiece(f.kind) || isLampPiece(f) || isPlanter(f) || rackSpots(f)) return 0;
    if (isTrellis(f)) return vineTrim(vineStage(f, now));
    const own = gardenTrim(f, now) ?? decorTrim(f, now) ?? furnishTrim(f, this.game) ?? fittingTrim(f, this.game) ?? adornTrim(f, this.game);
    if (own !== undefined) return own;
    const def = furnitureDef(f.kind);
    if (def.climber) {
      const r = roseStage(setAt, now, def.climber);
      return roseTrim(0, r.days, r.blooms);
    }
    if (mossyPiece(f)) return mossTrim(0, 's');
    return def.boat?.sail ? 0.25 : undefined;
  }

  /** You, in your look, wearing the piece and nothing else, or holding it, or at work with it; as tall as the canvas allows, or close on a small piece. */
  private drawBody(g: CanvasRenderingContext2D, what: PreviewOf, kind: PreviewKind, facing: number, t: number, W: number, H: number, dpr: number, still: boolean): void {
    const slot = slotOf(what.item);
    const piece: GearPiece = { id: what.item, ...(materialOf(what.material)?.id ? { material: materialOf(what.material)!.id } : {}) };
    const gear: GearLook = {};
    // A weapon in the fight it is held in (the figure puts one away on its back stood idle); a tool at its job.
    const weapon = kind === 'held' && slot === 'weapon';
    const job = weapon ? FIGHT_JOB : kind === 'held' ? TOOL_JOB.get(what.item) : undefined;
    if (slot && slot !== 'back' && slot !== 'side' && (weapon || !job)) gear[slot] = piece;
    // Its own body for each thing shown (`FigurePose.id`): turned as one body is, never blended from the last thing's.
    const pose: FigurePose = {
      phase: still ? 0 : t * 6, moving: false, gait: 0, facing, swimming: false, working: false,
      look: this.game.player.look ?? DEFAULT_LOOK, gear, ...(still ? {} : { id: `craft-preview|${this.key}` }),
    };
    if (job) {
      const len = ACTION_LEN.get(job) ?? 1;
      pose.working = true;
      pose.job = job;
      pose.act = { t: still ? len / 2 : t % len, length: len };
      if (!weapon) pose.tool = piece;
    }
    const stood: FigurePose = { ...pose, working: false, job: undefined, act: undefined, id: undefined };
    const view = viewOf(facing);
    const crown = onScreen(viewOf(STILL_FACING), figureJoint(stood, 'head', [0, 0, 2.6]));
    let zoom = (H - ROOM_OVER - ROOM_UNDER) / Math.max(1, -crown[1]);
    let fx = W / 2, fy = H - ROOM_UNDER;
    const frame = kind === 'held' ? FRAME_HELD : FRAME_ON_ITEM[what.item] ?? (slot ? FRAME_ON[slot as GearSlot] : undefined);
    if (frame) {
      zoom *= frame[2];
      const p = onScreen(view, figureJoint(stood, frame[0], frame[1]));
      fx = W / 2 - p[0] * zoom;
      fy = H / 2 - p[1] * zoom;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Animations off holds every body still in the world (`stillPose`); here the one frame is the job at its work.
    const held = still && animationsOff();
    if (held) setAnimations(true);
    try {
      drawFigure(g, fx, fy, zoom, pose, { ink: 1.2 });
    } finally {
      if (held) setAnimations(false);
    }
  }
}

/** How long a go of each job takes, seconds. */
const ACTION_LEN = new Map(ACTIONS.map((a) => [a.id, a.baseTime]));
