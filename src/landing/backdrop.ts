import { FullscreenCanvas } from '../engine/canvas';
import { lessMotion } from '../engine/motion';
import { Renderer } from '../render/renderer';
import { buildCove } from './cove';

/**
 * The landing page's backdrop: the cove (`./cove.ts`) drawn by the game's own
 * renderer, the water, the trees and the small life moving as they do on the
 * island. Loaded by the page after the form is up, so signing in never waits
 * on it.
 *
 * Kept cheap: at most `FPS` frames a second, nothing drawn while the tab is
 * hidden, a still frame under less motion (`prefers-reduced-motion`),
 * and no more device pixels than `PIXELS` (a phone's screen at twice its
 * size, a desktop's at about its own).
 */

/** The most frames drawn a second. */
const FPS = 30;
/** How far the view drifts back and forth across the cove, in tiles, and how long one sweep takes, in seconds. */
const DRIFT_TILES = 0.8;
const DRIFT_SECONDS = 70;
/** The cove is faded in once this share of the trees in view are drawn as solids, or after this many seconds whatever: not while they are coming in one by one. */
const READY_SHARE = 0.9;
const READY_WAIT = 6;
/** A screen this wide or wider has the box beside the cove; a narrower one has it under the stone (src/account.css). */
export const WIDE = 900;
/** The most device pixels drawn a frame, and the most to a CSS pixel. */
const PIXELS = 1_800_000;
const MOST_DPR = 2;

/** Device pixels to a CSS pixel for the window as it is: the screen's own, within `PIXELS` and `MOST_DPR`. */
const dprFor = (): number => Math.max(1, Math.min(MOST_DPR, Math.sqrt(PIXELS / Math.max(1, innerWidth * innerHeight))));

/**
 * The part of the screen the cove is framed in, in CSS px, with the box
 * standing in the rest: right of it on a wide screen, over it on a narrow one.
 */
export interface Room {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The view, framed on the room: on a wide screen the whole bay -- both arms,
 * the water between and the sea beyond -- with the stone at its head; on a
 * narrow one the stone and the bay off to its side, over the box, the view turned an eighth round for it.
 */
function framing(wide: boolean, room: Room): { a: number; b: number; fx: number; fy: number; zoom: number; turn: number } {
  const w = room.x1 - room.x0, h = room.y1 - room.y0;
  const mid = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
  if (wide) {
    // The cove is some fourteen tiles across its arms and twenty-six from the wood's edge to the open sea.
    const zoom = mid(Math.min(w / (14 * 68), h / (26 * 34)), 0.7, 1.25);
    return { a: 3, b: -0.5, fx: (room.x0 + w / 2) / room.x1, fy: 0.55, zoom, turn: 0 };
  }
  // An eighth of a turn round, so the bay lies off to the stone's side rather than straight below it, where the box is.
  // Not under 0.6, where the wildflowers are drawn as specks.
  const zoom = mid(room.x1 / 620, 0.62, 0.8);
  return { a: 0, b: 0, fx: 0.24, fy: (room.y1 * 0.64) / innerHeight, zoom, turn: 1 };
}

export function startBackdrop(el: HTMLCanvasElement, room: () => Room): () => void {
  const cove = buildCove();
  const canvas = new FullscreenCanvas(el);
  const fit = (): void => {
    const dpr = dprFor();
    if (dpr === canvas.maxDpr) return;
    canvas.maxDpr = dpr;
    canvas.resize();
  };
  fit();
  addEventListener('resize', fit);
  const renderer = new Renderer(canvas, cove.game);
  const cam = renderer.camera;
  cam.follow = false;
  renderer.hazeOn = false;
  const place = (t: number): void => {
    const W = canvas.width, H = canvas.height;
    const { a, b, fx, fy, zoom, turn } = framing(W >= WIDE, room());
    if (cam.rotation !== turn) cam.rotation = turn;
    cam.zoom = zoom;
    const sway = Math.sin((t / DRIFT_SECONDS) * Math.PI * 2) * DRIFT_TILES;
    const at = cove.spot(a, b + sway);
    cam.focus(at.x, at.y, cove.stone.h, null);
    cam.cx -= ((fx - 0.5) * W) / zoom;
    cam.cy -= ((fy - 0.5) * H) / zoom;
  };

  let last = 0;
  let clock = 0;
  let frame = 0;
  let stopped = false;
  /** Seconds drawn since the page came up, on the page's own clock: what the trees' pictures are waited for by. */
  let shown = 0;
  /** Whether the trees all have their solid pictures yet: until then a frame is still drawn under less motion, standing still. */
  let settled = false;
  const draw = (dt: number, spent: number): void => {
    clock += dt;
    shown += spent;
    place(clock);
    renderer.render(dt);
    const trees = renderer.drawnTrees;
    if (!settled && (trees.solid >= trees.all * READY_SHARE || shown > READY_WAIT)) {
      settled = true;
      el.classList.add('up');
    }
  };
  const tick = (now: number): void => {
    frame = 0;
    if (stopped || document.hidden) return;
    const still = lessMotion();
    if (still && settled) {
      draw(0, 0);
      return;
    }
    frame = requestAnimationFrame(tick);
    if (last && now - last < 1000 / FPS - 2) return;
    const spent = last ? Math.min(0.1, (now - last) / 1000) : 1 / FPS;
    last = now;
    draw(still ? 0 : spent, spent);
  };
  const go = (): void => {
    if (frame || stopped || document.hidden) return;
    last = 0;
    frame = requestAnimationFrame(tick);
  };
  document.addEventListener('visibilitychange', go);
  // Under less motion one frame once the trees are in, drawn again when the screen changes size.
  canvas.onResize(go);
  go();
  return () => {
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
  };
}
