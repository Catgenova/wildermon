/**
 * The Path card's moving picture (`pathcard.ts`): you, as the island draws you (`drawFigure`, the sculpted body in your
 * look and gear), at the next step's job, playing that job's clip (`clipOfJob`, `src/sculpt/anim/routes.ts`) with its
 * tool, one go every `baseTime` seconds as at skill one; or at an emote, or walking (`PathShow`). A step about a kind
 * has the kind beside you, drawn as the field guide draws it (`drawWildermonPortrait`), breathing.
 *
 * One small canvas, drawn only while the card is open and stopped when it shuts, at most `PREVIEW_FPS` frames a
 * second and never more than a `PREVIEW_SHARE`th of the page's time (as the Equipment window's figure). A still frame,
 * drawn once, with Animations off, with less motion, where the bodies are drawn by the processor rather than a
 * graphics card (`sculptSoft`), and where they are drawn flat (`flatFigures`).
 */
import { ACTION_BY_ID } from '../game/actions';
import { SPECIES } from '../game/creatures';
import { EMOTE_BY_ID } from '../game/emotes';
import type { Game } from '../game/game';
import { DEFAULT_LOOK } from '../game/look';
import type { PathShow } from '../game/path';
import { gearFrom, wornWire } from '../game/worn';
import { animationsOff, lessMotion, setAnimations } from '../engine/motion';
import { drawFigure, flatFigures, sculptedReady, sculptSoft, type FigurePose } from '../render/figure';
import { drawCreaturePortrait } from '../render/sprites';
import { drawWildermonPortrait, loadWildermon, modelled } from '../render/wildermon';

/** The canvas, CSS pixels. */
export const PREVIEW_W = 152;
export const PREVIEW_H = 112;
/** The most frames a second it is drawn at. */
const PREVIEW_FPS = 24;
/** And the most of the page's time it takes: the next frame waits this many times as long as the last took to draw. */
const PREVIEW_SHARE = 12;
/** The figure's height in its own units to the top of the head, with a little room over it (`drawPortrait`'s `PORTRAIT_TOP`). */
const FIGURE_ROOM = 39;
/** A kind's breaths, drawn as this many pictures and kept (`drawBeastPortrait` keeps each), and seconds a breath. */
const BREATHS = 8;
const BREATH_SECS = 2.4;
/** Seconds between two goes of an emote. */
const EMOTE_REST = 0.8;
/** Where in a go a still frame is taken: halfway through it, at the work. */
const STILL_AT = 0.5;
/** The ways the figure and a kind beside it face (`facingOf`: nought toward you, two to the right, six to the left). */
const FACE_ALONE = 1;
const FACE_KIND = 2;
const KIND_FACE = 7;

/** Whether bodies drawn by the processor get a still frame: a harness on software GL that is there to see it move clears it. */
export const previewKnobs = { stillOnSoft: true };

export class PathPreview {
  readonly el: HTMLCanvasElement;
  private show: PathShow | null = null;
  private frame = 0;
  private last = 0;
  /** How long the last frame took to draw, ms. */
  cost = 0;
  private started = 0;
  /** Frames drawn since the page opened, for the tests. */
  frames = 0;
  /** A still frame drawn whole (the body there and the kind with it): no more drawing until it is shown again. */
  private stillDone = false;
  /** The kind's model, once its line has come (`loadWildermon`); true for one drawn without a model. */
  private kindReady = false;

  constructor(private readonly game: Game) {
    this.el = document.createElement('canvas');
    this.el.className = 'path-pic';
    this.el.width = PREVIEW_W;
    this.el.height = PREVIEW_H;
  }

  /** Whether a still frame is drawn rather than a moving one. */
  private get still(): boolean {
    return animationsOff() || lessMotion() || (previewKnobs.stillOnSoft && sculptSoft()) || flatFigures();
  }

  /** Play a step's picture, from its start. */
  play(show: PathShow): void {
    this.stop();
    this.show = show;
    this.started = performance.now();
    this.stillDone = false;
    this.kindReady = !show.kind || !modelled(show.kind);
    if (show.kind && !this.kindReady) void loadWildermon(show.kind).then(() => (this.kindReady = true));
    let drawn = 0;
    const step = (ms: number): void => {
      if (!this.show) return;
      if (!this.still || !this.stillDone) {
        if (ms - this.last >= Math.max(1000 / PREVIEW_FPS, this.cost * PREVIEW_SHARE)) {
          this.last = ms;
          const t0 = performance.now();
          this.draw((ms - this.started) / 1000);
          this.frames++;
          // (the first frame of a picture bakes the body and the kind, and is no measure of the rest)
          this.cost = drawn++ ? performance.now() - t0 : 0;
        }
      }
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  /** Stop drawing: the card is shut. */
  stop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.show = null;
  }

  /** The figure's pose `t` seconds in: a go of the job fitted to its time, the emote over and over, or the walk. */
  pose(show: PathShow, t: number): FigurePose {
    const g = this.game;
    // Your gear, without what is in your hands: the job's tool is.
    const gear = gearFrom(wornWire((slot) => (slot === 'weapon' || slot === 'offhand' ? undefined : g.shown(slot))));
    const pose: FigurePose = {
      phase: t * 6, moving: false, gait: 0, facing: show.kind ? FACE_KIND : FACE_ALONE, swimming: false, working: false,
      look: g.player.look ?? DEFAULT_LOOK, gear,
    };
    if (show.walk) {
      pose.moving = true;
      pose.phase = t * 8;
    } else if (show.emote) {
      const len = EMOTE_BY_ID.get(show.emote)?.seconds ?? 1;
      const k = (t % (len + EMOTE_REST)) / len;
      if (k <= 1) {
        pose.emote = show.emote;
        pose.emoteT = k;
      }
    } else if (show.job) {
      pose.working = true;
      pose.job = show.job;
      const len = ACTION_BY_ID.get(show.job)?.baseTime ?? 0;
      if (len > 0) pose.act = { t: t % len, length: len };
      if (show.tool) pose.tool = { id: show.tool };
    }
    return pose;
  }

  /** A frame `t` seconds into the picture, drawn now, moving or not (the tests' pictures of it playing). */
  drawAt(show: PathShow, t: number): void {
    const was = this.show;
    this.show = show;
    this.draw(t, false);
    this.show = was;
  }

  private draw(t: number, still = this.still): void {
    const show = this.show;
    const c = this.el;
    const g = c.getContext('2d');
    if (!show || !g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = PREVIEW_W, H = PREVIEW_H;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    // A still frame: halfway through a go of the job, or the emote at its height.
    const len = show.job ? ACTION_BY_ID.get(show.job)?.baseTime ?? 0 : show.emote ? EMOTE_BY_ID.get(show.emote)?.seconds ?? 0 : 0;
    const at = still ? len * STILL_AT : t;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    // The kind on the right, as the field guide draws it, breathing.
    const kindW = show.kind ? W * 0.5 : 0;
    if (show.kind && this.kindReady) {
      const def = SPECIES[show.kind];
      if (def) {
        g.save();
        g.setTransform(1, 0, 0, 1, Math.round((W - kindW) * dpr), Math.round(H * 0.3 * dpr));
        const b = still ? 0 : Math.floor(((t / BREATH_SECS) % 1) * BREATHS);
        if (modelled(def.id)) drawWildermonPortrait(g, kindW * dpr, H * 0.62 * dpr, def.id, def.variants[0], KIND_FACE, undefined, 0, { breath: b / BREATHS }, b / BREATHS);
        else drawCreaturePortrait(g, kindW * dpr, H * 0.62 * dpr, def.id, def.variants[0], KIND_FACE);
        g.restore();
      }
    }
    // You, feet near the bottom, as tall as the canvas allows.
    const zoom = (H - 16) / FIGURE_ROOM;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fx = show.kind ? (W - kindW) * 0.7 : W / 2, fy = H - 8;
    const body = flatFigures() || sculptedReady();
    // Animations off holds every body still in the world (`stillPose`); here the one frame is the job at its work.
    const held = still && animationsOff();
    if (held) setAnimations(true);
    try {
      drawFigure(g, fx, fy, zoom, this.pose(show, at), { ink: 1.2 });
    } finally {
      if (held) setAnimations(false);
    }
    if (still && body && this.kindReady) this.stillDone = true;
  }
}
