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
const DRIFT_TILES = 1.6;
const DRIFT_SECONDS = 70;
/** The cove is faded in once this share of the trees in view are drawn as solids, or after this many seconds whatever: not while they are coming in one by one. */
const READY_SHARE = 0.9;
const READY_WAIT = 6;
/** The most device pixels drawn a frame, and the most to a CSS pixel. */
const PIXELS = 1_800_000;
const MOST_DPR = 2;

/** Device pixels to a CSS pixel for the window as it is: the screen's own, within `PIXELS` and `MOST_DPR`. */
const dprFor = (): number => Math.max(1, Math.min(MOST_DPR, Math.sqrt(PIXELS / Math.max(1, innerWidth * innerHeight))));

/** Where on the screen the stone stands, as a share of its width and height: clear of the box on a wide screen, above it on a narrow one. */
function stoneOnScreen(w: number, h: number): { fx: number; fy: number; zoom: number } {
  if (w >= 900) return { fx: 0.69, fy: 0.42, zoom: Math.max(0.9, Math.min(1.3, w / 1400)) };
  return { fx: 0.5, fy: Math.min(0.27, 230 / h), zoom: Math.max(0.55, Math.min(0.8, w / 650)) };
}

export function startBackdrop(el: HTMLCanvasElement): () => void {
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
  const place = (t: number): void => {
    const { fx, fy, zoom } = stoneOnScreen(canvas.width, canvas.height);
    cam.zoom = zoom;
    const sway = Math.sin((t / DRIFT_SECONDS) * Math.PI * 2) * DRIFT_TILES;
    cam.focus(cove.stone.x + sway * 0.5, cove.stone.y - sway * 0.5, cove.stone.h, null);
    cam.cx -= ((fx - 0.5) * canvas.width) / zoom;
    cam.cy -= ((fy - 0.5) * canvas.height) / zoom;
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
