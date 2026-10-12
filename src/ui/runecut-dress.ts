import { FRAME_REACH, frameFor, NICHE_H, NICHE_W, paintFrame, paintNiche, paintNightGlow, paintPlate, seedOf, sideOf, type ArtOpts } from './runecut-art';
import { watchLook, type Look } from './theme';

/**
 * Runecut's art on the page: each window's slab, its niche and its frame
 * (`src/ui/runecut-art.ts`, `src/ui/runecut-frames.ts`), laid in canvases on
 * and round the window.
 *
 *   - The slab is a canvas inside the window, under its content, the size of
 *     the window: its background.
 *   - The niche is a small canvas at the head of the title.
 *   - The slab has a rim (`RIM`, narrower where there is less room), and
 *     the window's content is set in from it by `--rim`, which is written on
 *     the element here, so nothing to read or press is ever on the rim.
 *   - The frame is painted on that rim. The part of it just past the
 *     window's edge -- `FRAME_REACH`, a knob, a knot, a seal -- is a canvas
 *     at the bottom of the interface, under every window, the HUD and the
 *     bars, so it never lies over another window's controls. It is not inside
 *     its window because a window clips what is in it (`overflow: hidden`,
 *     which its resize corner needs).
 *   - The part on the rim itself is a copy of that canvas's middle inside the
 *     window, over its slab. Neither takes a click.
 *   - With frames set to plain stone there is no frame canvas, and the
 *     slab's own rim shows.
 *
 * Each is painted once for a size and a light and kept; painted again only
 * when the window opens at a size it was not painted for, a resize has
 * stopped, or the look changes. The one thing that moves is the front
 * window's rune after dark, breathing, and the motes off it: one small canvas
 * a frame, and none under `prefers-reduced-motion`.
 */

/** Canvases painted, by what they are, so a window going back to a size or light it had takes the picture it had. */
const painted = new Map<string, HTMLCanvasElement>();
/** Device pixels kept in `painted`, at most; the least recently shown that are not on the page go first. */
const KEEP_PIXELS = 24_000_000;

function cachedCanvas(key: string, w: number, h: number, k: number, cls: string, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  let c = painted.get(key);
  if (c) {
    painted.delete(key);
    painted.set(key, c);
    return c;
  }
  c = document.createElement('canvas');
  c.className = cls;
  c.width = Math.max(1, Math.ceil(w * k));
  c.height = Math.max(1, Math.ceil(h * k));
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const g = c.getContext('2d');
  if (g) {
    g.setTransform(k, 0, 0, k, 0, 0);
    paint(g);
  }
  painted.set(key, c);
  let px = 0;
  for (const v of painted.values()) px += v.width * v.height;
  for (const [k2, v] of painted) {
    if (px <= KEEP_PIXELS) break;
    if (v.isConnected) continue;
    painted.delete(k2);
    px -= v.width * v.height;
  }
  return c;
}

const reduced = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** One thing dressed in the art: a window, the HUD or the toolbar. */
class Dressed {
  private plate: HTMLCanvasElement | null = null;
  private frame: HTMLCanvasElement | null = null;
  /** The part of the frame over the window itself: the band round its edge, inside it. */
  private edge: HTMLCanvasElement | null = null;
  private niche: HTMLCanvasElement | null = null;
  /** The niche after dark painted without its light, for the front window's light to be laid over each frame. */
  private unlit: HTMLCanvasElement | null = null;
  /** The niche the front window breathes in: its own canvas, so the still one in the cache is left as it was. */
  private live: HTMLCanvasElement | null = null;
  private due: ReturnType<typeof setTimeout> | null = null;
  private size = '';
  private readonly seed: number;

  constructor(
    private readonly art: RunecutArt,
    readonly id: string,
    readonly el: HTMLElement,
    private readonly glyph: string | null,
    private readonly rimOf: () => number,
  ) {
    this.seed = seedOf(id);
    this.size = `${el.offsetWidth}x${el.offsetHeight}`;
    // Where it is, its stacking and whether it is shown: copied across as they change, which costs nothing while nothing moves.
    new MutationObserver(() => this.follow()).observe(el, { attributes: true, attributeFilter: ['style', 'hidden', 'class'] });
    // A new size is painted once the resize has stopped; until then the old frame would sit wrong on it, so it is put away.
    new ResizeObserver(() => {
      const size = `${el.offsetWidth}x${el.offsetHeight}`;
      if (size === this.size) return;
      this.size = size;
      if (this.frame) this.frame.hidden = true;
      if (this.edge) this.edge.hidden = true;
      if (this.due) clearTimeout(this.due);
      this.due = setTimeout(() => {
        this.due = null;
        this.refresh();
      }, 150);
    }).observe(el);
  }

  get isFront(): boolean {
    return this.el.classList.contains('win-front') && !this.el.hidden;
  }

  /** Paint, or take from the cache, everything for the look and size as they are, and lay it on. */
  refresh(): void {
    const look = this.art.look;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    if (!look || look.ui !== 'runecut' || this.el.hidden || !w || !h) {
      this.lay(null, null, null);
      return;
    }
    const k = (window.devicePixelRatio || 1) * this.art.scale();
    const night = look.rc === 'night';
    const rim = this.rimOf();
    // The content's inset, from the same number the rim is painted at.
    if (this.el.style.getPropertyValue('--rim') !== `${rim}px`) this.el.style.setProperty('--rim', `${rim}px`);
    const o: ArtOpts = { seed: this.seed, night, side: sideOf(this.seed), rim };
    const kk = `${k.toFixed(3)}|${rim}`;
    const plate = cachedCanvas(`plate|${this.id}|${w}x${h}|${look.rc}|${kk}`, w, h, k, 'rc-plate', (g) => paintPlate(g, w, h, o));
    const R = FRAME_REACH;
    const kind = look.frames === 'themed' ? frameFor(this.id) : 'stone';
    // Plain stone is the slab's own rim, and wants no canvas of its own.
    const frame = kind === 'stone'
      ? null
      : cachedCanvas(`frame|${kind}|${this.id}|${w}x${h}|${look.rc}|${kk}`, w + 2 * R, h + 2 * R, k, 'ui-frame', (g) => {
        g.translate(R, R);
        paintFrame(g, w, h, kind, { seed: this.seed, night, rim });
      });
    if (frame) {
      frame.dataset.frameFor = this.id;
      frame.dataset.frame = kind;
      /*
       * The window's own box is left out of the canvas under it, so that what
       * of the frame is over the window is laid once, by the copy inside it,
       * and not again under it where the slab's cut corners and a see-through
       * slab would show it twice.
       */
      const W = w + 2 * R, H = h + 2 * R;
      frame.style.clipPath = `path(evenodd, 'M0 0 H${W} V${H} H0 Z M${R} ${R} H${R + w} V${R + h} H${R} Z')`;
    }
    this.edge = frame ? this.edgeOf(frame, w, h, k) : null;
    let niche: HTMLCanvasElement | null = null;
    if (this.glyph) {
      const glyph = this.glyph;
      niche = cachedCanvas(`niche|${glyph}|${look.rc}|${kk}`, NICHE_W, NICHE_H, k, 'rc-niche', (g) => paintNiche(g, glyph, o, k));
      this.unlit = night ? cachedCanvas(`niche-unlit|${glyph}|${kk}`, NICHE_W, NICHE_H, k, 'rc-niche', (g) => paintNiche(g, glyph, o, k, false)) : null;
      // The same picture serves every window with this rune, so each takes its own copy to show.
      niche = this.copyOf(niche);
    }
    this.lay(plate, frame, niche);
  }

  /** This window's own canvas showing a cached niche, made once and drawn into again when the picture changes. */
  private copyOf(src: HTMLCanvasElement): HTMLCanvasElement {
    let c = this.live;
    if (!c) {
      c = document.createElement('canvas');
      c.className = 'rc-niche';
      this.live = c;
    }
    if (c.width !== src.width || c.height !== src.height) {
      c.width = src.width;
      c.height = src.height;
    }
    c.style.width = `${NICHE_W}px`;
    c.style.height = `${NICHE_H}px`;
    const g = c.getContext('2d');
    if (g) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(src, 0, 0);
    }
    return c;
  }

  /** This window's canvas of the frame's part over the window: the window's own box of the frame picture, which past its rim is empty. */
  private edgeCopy: HTMLCanvasElement | null = null;
  private edgeOf(src: HTMLCanvasElement, w: number, h: number, k: number): HTMLCanvasElement {
    let c = this.edgeCopy;
    if (!c) {
      c = document.createElement('canvas');
      c.className = 'ui-frame-edge';
      c.dataset.frameFor = this.id;
      this.edgeCopy = c;
    }
    c.width = Math.ceil(w * k);
    c.height = Math.ceil(h * k);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const g = c.getContext('2d');
    if (g) {
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(src, -FRAME_REACH * k, -FRAME_REACH * k);
    }
    return c;
  }

  private lay(plate: HTMLCanvasElement | null, frame: HTMLCanvasElement | null, niche: HTMLCanvasElement | null): void {
    if (!frame) this.edgeCopy?.remove();
    else if (this.edge && this.edge.parentElement !== this.el) this.el.append(this.edge);
    if (this.plate && this.plate !== plate) this.plate.remove();
    if (this.frame && this.frame !== frame) this.frame.remove();
    if (this.niche && this.niche !== niche) this.niche.remove();
    this.plate = plate;
    this.frame = frame;
    this.niche = niche;
    if (plate && plate.parentElement !== this.el) this.el.prepend(plate);
    if (niche && !niche.isConnected) this.el.querySelector('.win-head')?.prepend(niche);
    if (frame && !frame.isConnected) this.art.under(frame);
    this.place();
  }

  /** Called on any change to the element: shown or hidden, moved, restacked. */
  private follow(): void {
    if (this.el.hidden) {
      if (this.frame) this.frame.hidden = true;
      if (this.edge) this.edge.hidden = true;
      return;
    }
    const size = `${this.el.offsetWidth}x${this.el.offsetHeight}`;
    // Opened, or shown again at a size it was not painted for: painted now.
    if (this.art.look?.ui === 'runecut' && (!this.plate || (size !== this.size && !this.due))) {
      this.size = size;
      this.refresh();
      return;
    }
    this.place();
  }

  /** Lay the frame under its window: the same place, less the reach. */
  private place(): void {
    const c = this.frame;
    if (!c) return;
    c.hidden = this.el.hidden || !!this.due;
    if (this.edge) this.edge.hidden = c.hidden;
    if (c.hidden) return;
    // Measured on the screen rather than by offsets, which leave out a transform such as the toolbar's centring.
    const at = this.art.place(this.el);
    c.style.left = `${at.x - FRAME_REACH}px`;
    c.style.top = `${at.y - FRAME_REACH}px`;
  }

  /** The front window's rune after dark, at `t` seconds: its niche cleared to the unlit copy and lit again. */
  breathe(t: number): void {
    const c = this.niche, base = this.unlit;
    if (!c || !base || !this.glyph) return;
    const g = c.getContext('2d');
    if (!g) return;
    const k = c.width / NICHE_W;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(base, 0, 0);
    g.setTransform(k, 0, 0, k, 0, 0);
    paintNightGlow(g, this.glyph, { seed: this.seed, night: true, side: 'left' }, t, k);
  }

  /** Back to its still light, once it is no longer the one that breathes. */
  still(): void {
    this.refresh();
  }
}

/**
 * Everything dressed in the art, and the look it is dressed for. Made once by
 * the UI; windows are added as they are made.
 */
export class RunecutArt {
  look: Look | null = null;
  private readonly all: Dressed[] = [];
  private breathing: Dressed | null = null;
  private tick = 0;

  constructor(private readonly root: HTMLElement) {
    watchLook((look) => {
      this.look = look;
      for (const d of this.all) d.refresh();
      this.wake();
    });
    // The interface's own scale, which the canvases are drawn at, moves with the screen and the size setting.
    window.addEventListener('resize', () => {
      for (const d of this.all) d.refresh();
    });
  }

  /** Device pixels an interface pixel is drawn at, before the screen's own ratio. */
  scale(): number {
    return this.root.offsetWidth ? this.root.getBoundingClientRect().width / this.root.offsetWidth : 1;
  }

  /** Where an element is in the interface's own px, transforms and all. */
  place(el: HTMLElement): { x: number; y: number } {
    const k = this.scale();
    const a = el.getBoundingClientRect(), b = this.root.getBoundingClientRect();
    return { x: (a.left - b.left) / k, y: (a.top - b.top) / k };
  }

  /** Put a frame canvas at the bottom of the interface, under everything else in it. */
  under(c: HTMLCanvasElement): void {
    this.root.prepend(c);
  }

  /** Dress something: `id` says which frame it wears (`frameFor`), `rim` how wide its rim is, `glyph` its window's rune, for its niche. */
  add(id: string, el: HTMLElement, rim: () => number, glyph: string | null = null): void {
    const d = new Dressed(this, id, el, glyph, rim);
    this.all.push(d);
    d.refresh();
    if (glyph) new MutationObserver(() => this.wake()).observe(el, { attributes: true, attributeFilter: ['class', 'hidden'] });
  }

  /** Start or stop the one animation there is: the front window's rune after dark. */
  private wake(): void {
    const night = this.look?.ui === 'runecut' && this.look.rc === 'night' && !reduced();
    const front = night ? this.all.find((d) => d.isFront) ?? null : null;
    if (front === this.breathing) return;
    const was = this.breathing;
    this.breathing = front;
    was?.still();
    if (front && !this.tick) {
      const step = (): void => {
        if (!this.breathing) {
          this.tick = 0;
          return;
        }
        this.breathing.breathe(performance.now() / 1000);
        this.tick = requestAnimationFrame(step);
      };
      this.tick = requestAnimationFrame(step);
    }
  }
}
