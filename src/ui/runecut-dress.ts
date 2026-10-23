import { frameFor, frameLamps, reachOf, NICHE_H, NICHE_W, paintFrame, paintNiche, paintNightGlow, paintPlate, seedOf, sideOf, type ArtOpts } from './runecut-art';
import { watchLook, type Look } from './theme';
import type { Join, Seam } from './snapgrid';
import { livesOn, paintLife, type LifePiece, type LifeWorld } from './runecut-life';

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
 *     window's edge -- its reach (`reachOf`), a knob, a knot, a seal -- is a canvas
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
 * stopped, or the look changes, and shown as images (`Shown`), not canvases.
 * What moves: the front window's rune after dark, breathing, and the motes
 * off it, one small canvas drawn with the life on the frames (`LIFE_MS`);
 * not under `prefers-reduced-motion`. The light of a lamp on a frame
 * (`frameLamps`) is a still glow over the window's edge and another under it
 * past the edge.
 */

/** Canvases painted, by what they are, so a window going back to a size or light it had takes the picture it had. */
const painted = new Map<string, HTMLCanvasElement>();
/** Device pixels kept in `painted`, at most; the least recently shown that no piece is showing go first. */
const KEEP_PIXELS = 24_000_000;
/** Each picture in `painted` as an image file, made from its canvas the first time it is shown (`Shown`). */
const files = new Map<string, Promise<string>>();
/** How many pieces are showing each picture in `painted` now; one being shown is kept. */
const showing = new Map<string, number>();

function hold(key: string, by: number): void {
  const n = (showing.get(key) ?? 0) + by;
  if (n > 0) showing.set(key, n);
  else showing.delete(key);
}

function cachedCanvas(key: string, w: number, h: number, k: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  let c = painted.get(key);
  if (c) {
    painted.delete(key);
    painted.set(key, c);
    return c;
  }
  c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * k));
  c.height = Math.max(1, Math.ceil(h * k));
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
    if (showing.has(k2)) continue;
    painted.delete(k2);
    void files.get(k2)?.then((url) => url && URL.revokeObjectURL(url));
    files.delete(k2);
    made.delete(k2);
    px -= v.width * v.height;
  }
  return c;
}

/** The pictures whose files are made, by what they are: shown at once, without waiting on `files`. */
const made = new Map<string, string>();

/**
 * The image file of a picture in `painted`, made once. Written from a copy
 * off the page where the browser has one (`OffscreenCanvas`), which it
 * writes away from the page's own work: a canvas on the page writes its file
 * only once the page is idle, and a page drawing the island every frame
 * hardly ever is.
 */
function fileOf(key: string, c: HTMLCanvasElement): Promise<string> {
  let f = files.get(key);
  if (!f) {
    const blob = typeof OffscreenCanvas === 'function'
      ? (() => {
        const o = new OffscreenCanvas(c.width, c.height);
        o.getContext('2d')?.drawImage(c, 0, 0);
        return o.convertToBlob({ type: 'image/png' }).catch(() => null);
      })()
      : new Promise<Blob | null>((done) => c.toBlob(done, 'image/png'));
    f = blob.then((b) => {
      const url = b ? URL.createObjectURL(b) : '';
      if (url && files.has(key)) made.set(key, url);
      return url;
    });
    files.set(key, f);
  }
  return f;
}

/**
 * A still picture on the page: an image, not a canvas.
 *
 * Every canvas on the page is a layer of its own that the browser puts
 * together with the rest on every frame, and everything drawn over one is
 * pushed onto layers of its own as well: a window's slab, frame, edge and
 * niche as four canvases made some ninety layers of five windows, the toolbar
 * and the status panel, against Classic's thirty, and were most of what
 * Runecut cost a frame. An image is painted in with the window it is in.
 *
 * Until a picture's file is written (`fileOf`) a copy of its canvas stands
 * in, at once, where the image will go; or, the same size, the picture shown
 * before stays. Either is swapped for the image once it is decoded, so
 * nothing blinks and nothing waits.
 */
class Shown {
  el: HTMLElement;
  key = '';
  /** The size, in interface px, of the picture `el` shows: empty while it shows none. */
  size = '';
  private asked = 0;

  constructor(private readonly cls: string, private readonly onReady: () => void) {
    this.el = this.image();
  }

  private image(): HTMLImageElement {
    const img = document.createElement('img');
    img.className = this.cls;
    img.alt = '';
    img.draggable = false;
    return img;
  }

  /** `next` in the place of what is shown, wearing what it wore, `w` by `h` interface px. */
  private put(next: HTMLElement, w: number, h: number, dress?: (el: HTMLElement) => void): void {
    const was = this.el;
    next.style.cssText = was.style.cssText;
    next.hidden = was.hidden;
    Object.assign(next.dataset, was.dataset);
    next.style.width = `${w}px`;
    next.style.height = `${h}px`;
    dress?.(next);
    if (was.isConnected) was.replaceWith(next);
    this.el = next;
    this.size = `${w}x${h}`;
    this.onReady();
  }

  /** Show the picture painted as `key` on `src`, `w` by `h` interface px; `dress` is anything else the element showing it wears. */
  show(key: string, src: HTMLCanvasElement, w: number, h: number, dress?: (el: HTMLElement) => void): void {
    if (key === this.key) return;
    hold(key, 1);
    if (this.key) hold(this.key, -1);
    this.key = key;
    const ask = ++this.asked;
    if (!made.has(key) || this.size !== `${w}x${h}`) {
      const stand = document.createElement('canvas');
      stand.className = this.cls;
      stand.width = src.width;
      stand.height = src.height;
      stand.getContext('2d')?.drawImage(src, 0, 0);
      this.put(stand, w, h, dress);
    }
    void fileOf(key, src).then(async (url) => {
      if (ask !== this.asked || !url) return;
      const next = this.image();
      next.src = url;
      await next.decode().catch(() => undefined);
      if (ask === this.asked) this.put(next, w, h, dress);
    });
  }

  /** Off the page, showing nothing. */
  drop(): void {
    if (this.key) hold(this.key, -1);
    this.key = '';
    this.size = '';
    this.asked++;
    this.el.remove();
    this.el = this.image();
  }
}

/** Frames of cloth, leather or paper; every other is hard (wood, stone, metal), for how a seam between two is fastened (`RunecutArt.paintSeams`). */
export const SOFT = new Set(['burlap', 'book', 'treasure']);
/** Along a seam: a cross-stitch, a mortar joint and a brass pin every so many interface px. */
export const STITCH_EVERY = 16;
export const JOINT_EVERY = 48;
export const PIN_EVERY = 40;
/** The life on the frames is drawn this often, in ms: thirty times a second. */
const LIFE_MS = 1000 / 30;
/**
 * How far past a piece's box, in interface px, anything that lives on its
 * frame is ever drawn: the most a half hour of every one of them came to,
 * day and night, with snow, was the songbird by day at 155 px. The life's
 * canvas reaches only that far round the pieces it is drawn on (`paintLife`).
 */
const LIFE_REACH = 160;
/** How far past a seam's line anything of it is drawn, in interface px: its end's lozenge (9) and that lozenge's shadow. */
const SEAM_REACH = 14;
/** How long a new seam's glint takes to run its length. */
const GLINT_MS = 650;

function gold(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, night: boolean): CanvasGradient {
  const f = g.createLinearGradient(x0, y0, x1, y1);
  f.addColorStop(0, night ? '#d8c58e' : '#fbe7a6');
  f.addColorStop(0.45, night ? '#b8954c' : '#d9b25c');
  f.addColorStop(1, '#8e6526');
  return f;
}

/** Whether the system asks for less motion: the query made once, and read each time it is asked. */
let lessMotion: MediaQueryList | null | undefined;
const reduced = (): boolean => (lessMotion === undefined ? (lessMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null) : lessMotion)?.matches ?? false;

/** One thing dressed in the art: a window, the HUD or the toolbar. */
class Dressed {
  private readonly plate: Shown;
  private readonly frame: Shown;
  /** The part of the frame over the window itself: the band round its edge, inside it. */
  private readonly edge: Shown;
  private readonly niche: Shown;
  /** Whether it wears a frame now (none in plain stone), and the size its frame's picture is, past the window by its reach. */
  private framed = false;
  private frameSize = '';
  private edgeSize = '';
  /** The niche after dark painted without its light, for the front window's light to be laid over (`breathe`). */
  private unlit: HTMLCanvasElement | null = null;
  /** The niche the front window breathes in after dark, over its still picture: the one canvas a window has. */
  private live: HTMLCanvasElement | null = null;
  private due: ReturnType<typeof setTimeout> | null = null;
  private size = '';
  /** How far its frame stands past it (`reachOf`), for laying the frame under it. */
  private reach = 0;
  /** The frame it wears and how wide its band is, as last laid (`refresh`), for what lives on it (`lifePiece`). */
  private kind = 'stone';
  private rim = 0;
  /** The glow of each lamp on its frame: over the window's edge, inside it, and under it past the edge, with where each lamp is on the window. */
  private lamps: Array<{ x: number; y: number; r: number; over: HTMLElement; under: HTMLElement }> = [];
  private readonly seed: number;
  /** The stretches of its sides another piece is joined along (`src/ui/snapgrid.ts`): no part of its frame stands past them. */
  private joins: Join[] = [];
  private joinsKey = '';
  /** Where it is in the interface and how big, as last measured; measured again once it has moved, been restacked, shown or resized. */
  private box: { x: number; y: number; w: number; h: number } | null = null;

  constructor(
    private readonly art: RunecutArt,
    readonly id: string,
    readonly el: HTMLElement,
    private readonly glyph: string | null,
    private readonly rimOf: (kind: string) => number,
  ) {
    this.seed = seedOf(id);
    this.size = `${el.offsetWidth}x${el.offsetHeight}`;
    const laid = (): void => this.place();
    this.plate = new Shown('rc-plate', laid);
    this.frame = new Shown('ui-frame', laid);
    this.edge = new Shown('ui-frame-edge', laid);
    this.niche = new Shown('rc-niche', laid);
    // Where it is, its stacking and whether it is shown: copied across as they change, which costs nothing while nothing moves.
    new MutationObserver(() => this.follow()).observe(el, { attributes: true, attributeFilter: ['style', 'hidden', 'class'] });
    // A new size is painted once the resize has stopped; until then the old frame would sit wrong on it, so it is put away.
    new ResizeObserver(() => {
      this.box = null;
      const size = `${el.offsetWidth}x${el.offsetHeight}`;
      if (size === this.size) return;
      this.size = size;
      this.frame.el.hidden = true;
      this.edge.el.hidden = true;
      for (const l of this.lamps) l.under.hidden = l.over.hidden = true;
      if (this.due) clearTimeout(this.due);
      this.due = setTimeout(() => {
        this.due = null;
        this.refresh();
      }, 150);
    }).observe(el);
  }

  /** Told which stretches of its sides are joined; its frame is laid again when that changes. */
  join(joins: Join[]): void {
    const key = joins.map((j) => `${j.side}${j.s0}-${j.s1}`).join(',');
    if (key === this.joinsKey) return;
    this.joins = joins;
    this.joinsKey = key;
    if (!this.el.hidden && !this.due) this.refresh();
  }

  /** Forget where it was measured: the interface's own box has changed. */
  moved(): void {
    this.box = null;
  }

  /**
   * Where it is and what it wears, for the life on its frame; null while it is
   * not laid (hidden, not Runecut, or between sizes). Measured once after it
   * has moved, not on every frame of the life drawn on it.
   */
  lifePiece(): LifePiece | null {
    if (this.el.hidden || !this.plate.key || this.due || !this.plate.el.isConnected) return null;
    const b = this.box ?? (this.box = { ...this.art.place(this.el), w: this.el.offsetWidth, h: this.el.offsetHeight });
    return { kind: this.kind, x: b.x, y: b.y, w: b.w, h: b.h, F: this.rim, R: this.reach, seed: this.seed };
  }

  get isFront(): boolean {
    return this.el.classList.contains('win-front') && !this.el.hidden;
  }

  /** Paint, or take from the cache, everything for the look and size as they are, and lay it on. */
  refresh(): void {
    const look = this.art.look;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    this.box = null;
    if (!look || look.ui !== 'runecut' || this.el.hidden || !w || !h) {
      delete this.el.dataset.frame;
      this.lampsFor([], false);
      this.still();
      for (const s of [this.plate, this.frame, this.edge, this.niche]) s.drop();
      this.framed = false;
      this.unlit = null;
      return;
    }
    const k = (window.devicePixelRatio || 1) * this.art.scale();
    const night = look.rc === 'night';
    const kind = look.frames === 'themed' ? frameFor(this.id) : 'stone';
    // Which frame it wears, for the parts of the window itself that wear it too (src/style.css).
    if (this.el.dataset.frame !== kind) this.el.dataset.frame = kind;
    const rim = this.rimOf(kind);
    this.kind = kind;
    this.rim = rim;
    // The content's inset, from the same number the rim is painted at.
    if (this.el.style.getPropertyValue('--rim') !== `${rim}px`) {
      this.el.style.setProperty('--rim', `${rim}px`);
      // The window has just grown or shrunk by the difference, and is painted at that size once it has.
      if (this.el.offsetWidth !== w || this.el.offsetHeight !== h) {
        this.size = `${this.el.offsetWidth}x${this.el.offsetHeight}`;
        this.refresh();
        return;
      }
    }
    const o: ArtOpts = { seed: this.seed, night, side: sideOf(this.seed), rim, frame: kind };
    const kk = `${k.toFixed(3)}|${rim}`;
    const plateKey = `plate|${this.id}|${kind}|${w}x${h}|${look.rc}|${kk}`;
    this.plate.show(plateKey, cachedCanvas(plateKey, w, h, k, (g) => paintPlate(g, w, h, o)), w, h);
    const R = reachOf(kind);
    this.reach = R;
    // Plain stone is the slab's own rim, and wants no frame of its own.
    this.framed = kind !== 'stone';
    if (this.framed) {
      const W = w + 2 * R, H = h + 2 * R;
      const frameKey = `frame|${kind}|${this.id}|${w}x${h}|${look.rc}|${kk}`;
      const frame = cachedCanvas(frameKey, W, H, k, (g) => {
        g.translate(R, R);
        paintFrame(g, w, h, kind, { seed: this.seed, night, rim });
      });
      /*
       * The picture under the window: the frame less the window's own box,
       * so that what of the frame is over the window is laid once, by the
       * copy inside it (`edge`), and not again under it where the slab's cut
       * corners and a see-through slab would show it twice. The window clips
       * what is in it at its padding edge, so the border's ring is kept here,
       * under it, and the hole is only the padding box. Cut out of the
       * picture once rather than clipped off it on the page, where a clip on
       * a layer is a mask the screen is put together through every frame.
       *
       * And nothing standing past a stretch of side that another piece is
       * joined along, nor for a reach either way along it: the seam there is
       * the two of them, and a knob or a knot would lie across the neighbour.
       */
      const bl = this.el.clientLeft, bt = this.el.clientTop;
      const joins = this.joins;
      const underKey = `under|${frameKey}|${bl},${bt}|${this.joinsKey}`;
      const under = cachedCanvas(underKey, W, H, k, (g) => {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(frame, 0, 0);
        g.setTransform(k, 0, 0, k, R * k, R * k);
        g.globalCompositeOperation = 'destination-out';
        g.fillRect(bl, bt, w - 2 * bl, h - 2 * bt);
        for (const j of joins) {
          const along = j.s1 - j.s0 + 2 * R;
          if (j.side === 'right') g.fillRect(w, j.s0 - R, R + 1, along);
          if (j.side === 'left') g.fillRect(-R - 1, j.s0 - R, R + 1, along);
          if (j.side === 'bottom') g.fillRect(j.s0 - R, h, along, R + 1);
          if (j.side === 'top') g.fillRect(j.s0 - R, -R - 1, along, R + 1);
        }
        g.globalCompositeOperation = 'source-over';
      });
      this.frame.show(underKey, under, W, H, (el) => {
        el.dataset.frameFor = this.id;
        el.dataset.frame = kind;
      });
      this.frameSize = `${W}x${H}`;
      this.edgeSize = `${w}x${h}`;
      // The part of the frame over the window: the window's own box of the frame picture, which past its rim is empty.
      const edgeKey = `edge|${frameKey}`;
      this.edge.show(edgeKey, cachedCanvas(edgeKey, w, h, k, (g) => {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(frame, -R * k, -R * k);
      }), w, h, (el) => (el.dataset.frameFor = this.id));
    } else {
      this.frame.drop();
      this.edge.drop();
    }
    this.lampsFor(this.framed ? frameLamps(kind, w, h, rim) : [], night);
    if (this.glyph) {
      const glyph = this.glyph;
      const nicheKey = `niche|${kind === 'burlap' || kind === 'bench' || kind === 'runestone' || kind === 'parchment' || kind === 'treasure' || kind === 'wicker' || kind === 'ironbound' ? kind : ''}|${glyph}|${look.rc}|${kk}`;
      this.niche.show(nicheKey, cachedCanvas(nicheKey, NICHE_W, NICHE_H, k, (g) => paintNiche(g, glyph, o, k)), NICHE_W, NICHE_H);
      // A badge with no rune on it (`paintHammers`, `paintTablet`, `paintCompass`, `paintPaw`, `paintGear`) has nothing to breathe after dark.
      this.unlit = night && kind !== 'bench' && kind !== 'runestone' && kind !== 'parchment' && kind !== 'treasure' && kind !== 'wicker' && kind !== 'ironbound' ? cachedCanvas(`niche-unlit|${kind === 'burlap' ? kind : ''}|${glyph}|${kk}`, NICHE_W, NICHE_H, k, (g) => paintNiche(g, glyph, o, k, false)) : null;
      if (!this.unlit) this.still();
    }
    this.lay();
  }

  /** A glow for each lamp, made or kept. */
  private lampsFor(at: Array<{ x: number; y: number; r: number }>, night: boolean): void {
    while (this.lamps.length > at.length) {
      const l = this.lamps.pop();
      l?.over.remove();
      l?.under.remove();
    }
    at.forEach((p, i) => {
      let l = this.lamps[i];
      if (!l) {
        const make = (): HTMLElement => {
          const e = document.createElement('div');
          e.className = 'rc-lamp';
          return e;
        };
        l = { ...p, over: make(), under: make() };
        this.lamps[i] = l;
      }
      Object.assign(l, p);
      for (const e of [l.over, l.under]) {
        e.classList.toggle('rc-lamp-night', night);
        e.style.width = e.style.height = `${p.r * 2}px`;
      }
    });
  }

  private lay(): void {
    const el = this.el;
    const plate = this.plate.el;
    if (plate.parentElement !== el) el.prepend(plate);
    if (this.framed && this.edge.el.parentElement !== el) el.append(this.edge.el);
    /*
     * A picture inside the window is laid from its padding edge, inside the
     * window's border; everything is painted from its outer edge, as the
     * frame under it is laid. Back out by the border, so the two halves of a
     * frame meet on the same pixel and the slab is where its window is.
     */
    for (const c of this.framed ? [plate, this.edge.el] : [plate]) {
      c.style.left = `${-el.clientLeft}px`;
      c.style.top = `${-el.clientTop}px`;
    }
    if (this.niche.key && !this.niche.el.isConnected) el.querySelector('.win-head')?.prepend(this.niche.el);
    if (this.framed && !this.frame.el.isConnected) this.art.under(this.frame.el);
    for (const l of this.lamps) {
      l.over.style.left = `${l.x - l.r - el.clientLeft}px`;
      l.over.style.top = `${l.y - l.r - el.clientTop}px`;
      if (l.over.parentElement !== el) el.append(l.over);
      // Just over its own frame, under every window.
      if (this.framed && l.under.previousElementSibling !== this.frame.el) this.frame.el.after(l.under);
    }
    this.place();
  }

  /** Called on any change to the element: shown or hidden, moved, restacked. */
  private follow(): void {
    this.box = null;
    if (this.el.hidden) {
      this.frame.el.hidden = true;
      this.edge.el.hidden = true;
      for (const l of this.lamps) l.under.hidden = true;
      return;
    }
    const size = `${this.el.offsetWidth}x${this.el.offsetHeight}`;
    // Opened, or shown again at a size it was not painted for: painted now.
    if (this.art.look?.ui === 'runecut' && (!this.plate.key || (size !== this.size && !this.due))) {
      this.size = size;
      this.refresh();
      return;
    }
    this.place();
  }

  /** Lay the frame under its window: the same place, less the reach; put away while its picture is not yet the one for the size it is now. */
  private place(): void {
    if (!this.framed) return;
    const c = this.frame.el;
    // A picture of the frame for another light or another join stays until the new one comes; one for another size does not.
    const away = this.el.hidden || !!this.due || this.frame.size !== this.frameSize || this.edge.size !== this.edgeSize;
    c.hidden = away;
    this.edge.el.hidden = away;
    for (const l of this.lamps) l.under.hidden = l.over.hidden = away;
    if (away) return;
    // Measured on the screen rather than by offsets, which leave out a transform such as the toolbar's centring.
    const at = this.art.place(this.el);
    c.style.left = `${at.x - this.reach}px`;
    c.style.top = `${at.y - this.reach}px`;
    for (const l of this.lamps) {
      l.under.style.left = `${at.x + l.x - l.r}px`;
      l.under.style.top = `${at.y + l.y - l.r}px`;
    }
  }

  /** The front window's rune after dark, at `t` seconds: a canvas over its still niche, cleared to the unlit picture and lit again. */
  breathe(t: number): void {
    const base = this.unlit, still = this.niche.el;
    if (!base || !this.glyph || !still.isConnected) return;
    let c = this.live;
    if (!c) {
      c = document.createElement('canvas');
      c.className = 'rc-niche';
      c.style.width = `${NICHE_W}px`;
      c.style.height = `${NICHE_H}px`;
      this.live = c;
    }
    if (c.width !== base.width || c.height !== base.height) {
      c.width = base.width;
      c.height = base.height;
    }
    if (c.nextElementSibling !== still) still.before(c);
    still.hidden = true;
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
    this.live?.remove();
    this.niche.el.hidden = false;
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

  constructor(private readonly root: HTMLElement) {
    this.glintCanvas = this.layer('rc-glints');
    this.lifeCanvas = this.layer('rc-life');
    // The life on the frames and the front window's breathing rune, drawn together every `LIFE_MS`.
    const step = (now: number): void => {
      requestAnimationFrame(step);
      if (now - this.lifeLast < LIFE_MS) return;
      this.lifeLast = now;
      this.paintLife(now / 1000);
      this.breathing?.breathe(now / 1000);
    };
    requestAnimationFrame(step);
    watchLook((look) => {
      this.look = look;
      for (const d of this.all) d.refresh();
      this.paintSeams();
      this.wake();
    });
    // The interface's own scale, which the canvases are drawn at, moves with the screen and the size setting.
    window.addEventListener('resize', () => {
      for (const d of this.all) {
        d.moved();
        d.refresh();
      }
      this.paintSeams();
    });
  }

  /** A canvas over the whole interface, over every window and under menus and tooltips (src/style.css), taking no clicks. */
  private layer(cls: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.className = cls;
    c.hidden = true;
    this.root.append(c);
    return c;
  }

  /** One canvas for each seam (`paintSeams`). */
  private readonly seamCanvases: HTMLCanvasElement[] = [];
  private readonly lifeCanvas: HTMLCanvasElement;
  private lifeLast = 0;
  private lifeDrew = false;
  /** Where the canvas is laid, and how big, in interface px, as last drawn: x, y, w, h. */
  private lifeBox = '';
  /** Whether the life on the frames is wanted (the setting, Fast graphics, a phone's screen), and what the island says to it; set by the UI. */
  lifeOn: () => boolean = () => false;
  lifeWorld: (() => Omit<LifeWorld, 'night'>) | null = null;

  /**
   * The animals and lights on the frames (`src/ui/runecut-life.ts`), drawn
   * afresh every `LIFE_MS` over everything but what is inside a window: each
   * window's and bar's room inside its band is taken out of the canvas after.
   *
   * The canvas covers only the pieces that have anything living on them this
   * hour (`livesOn`), and `LIFE_REACH` round them, and is laid over that part
   * of the interface. It was the whole interface, and a canvas is handed on
   * to the screen whole every time it is drawn in: a mouse on the pack's
   * frame was a full screen of pixels thirty times a second, some four
   * milliseconds of every frame. With nothing living on any piece it is put
   * away until there is.
   */
  private paintLife(t: number): void {
    const c = this.lifeCanvas;
    const on = this.look?.ui === 'runecut' && this.seamsShown && !reduced() && this.lifeOn() && !!this.lifeWorld;
    const all = on ? this.all.map((d) => d.lifePiece()).filter((p): p is LifePiece => !!p) : [];
    const world = on && this.lifeWorld ? { ...this.lifeWorld(), night: this.look?.rc === 'night' } : null;
    const pieces = world ? all.filter((p) => livesOn(p.kind, world)) : [];
    const w = this.root.offsetWidth, h = this.root.offsetHeight;
    // The box round every live piece and its reach, in whole interface px, kept to the interface.
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (const p of pieces) {
      x0 = Math.min(x0, Math.floor(p.x - LIFE_REACH));
      y0 = Math.min(y0, Math.floor(p.y - LIFE_REACH));
      x1 = Math.max(x1, Math.ceil(p.x + p.w + LIFE_REACH));
      y1 = Math.max(y1, Math.ceil(p.y + p.h + LIFE_REACH));
    }
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(w, x1);
    y1 = Math.min(h, y1);
    if (!world || x1 <= x0 || y1 <= y0) {
      if (this.lifeDrew) {
        c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
        c.hidden = true;
        this.lifeDrew = false;
      }
      return;
    }
    const k = (window.devicePixelRatio || 1) * this.scale();
    const cw = Math.max(1, Math.ceil((x1 - x0) * k)), ch = Math.max(1, Math.ceil((y1 - y0) * k));
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    const box = `${x0},${y0},${x1 - x0},${y1 - y0}`;
    if (box !== this.lifeBox) {
      this.lifeBox = box;
      c.style.left = `${x0}px`;
      c.style.top = `${y0}px`;
      c.style.width = `${x1 - x0}px`;
      c.style.height = `${y1 - y0}px`;
    }
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
    g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    for (const p of pieces) paintLife(g, p, t, world);
    // Each piece's room inside its band taken out again after: the same pixels as drawing through a clip with every room cut out of it, which cost more than the drawing.
    g.globalCompositeOperation = 'destination-out';
    for (const p of all) g.fillRect(p.x + p.F, p.y + p.F, Math.max(0, p.w - p.F * 2), Math.max(0, p.h - p.F * 2));
    g.globalCompositeOperation = 'source-over';
    c.hidden = false;
    this.lifeDrew = true;
  }
  private readonly glintCanvas: HTMLCanvasElement;
  private seamList: Seam[] = [];
  private seamsShown = false;
  private glintFrame = 0;

  /**
   * Where pieces are joined (`WindowManager.rejoin`): each piece's frame
   * stops at the stretches of it that are joined, and the seams are drawn
   * over them, the ones in `fresh` with a glint running along them.
   */
  seams(seams: Seam[], joins: Map<string, Join[]>, fresh: Seam[], shown: boolean): void {
    this.seamList = seams;
    this.seamsShown = shown;
    for (const d of this.all) d.join(joins.get(d.id) ?? []);
    this.paintSeams();
    if (fresh.length && shown && this.look?.ui === 'runecut' && !reduced()) this.glint(fresh);
  }

  /** The frame a piece wears, as `Dressed.refresh` chooses it. */
  private kindOf(id: string): string {
    return this.look?.frames === 'themed' ? frameFor(id) : 'stone';
  }

  /** Size a canvas to a box of the interface, by default the whole of it, and lay it there; drawn on in the interface's own px. */
  private fit(c: HTMLCanvasElement, x0 = 0, y0 = 0, x1 = this.root.offsetWidth, y1 = this.root.offsetHeight): CanvasRenderingContext2D | null {
    const w = x1 - x0, h = y1 - y0;
    const k = (window.devicePixelRatio || 1) * this.scale();
    c.width = Math.max(1, Math.ceil(w * k));
    c.height = Math.max(1, Math.ceil(h * k));
    c.style.left = `${x0}px`;
    c.style.top = `${y0}px`;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const g = c.getContext('2d');
    g?.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    return g;
  }

  /**
   * Every seam: one groove down the join, then by what the two frames are
   * made of (`SOFT`), cloth or leather to cloth or leather cross-stitched
   * every `STITCH_EVERY` px, anything hard to hard mortared with a joint every
   * `JOINT_EVERY` px, and soft to hard pinned in brass every `PIN_EVERY` px;
   * a gold lozenge caps each end, over the corners that meet there.
   */
  private paintSeams(): void {
    const on = this.look?.ui === 'runecut' && this.seamsShown && this.seamList.length > 0;
    const list = on ? this.seamList : [];
    /*
     * A canvas for each seam, only as big as it and `SEAM_REACH` round it: a
     * canvas is laid over the screen whole on every frame, and one the size
     * of the interface was a screen of empty pixels on every frame for a few
     * lines down joins.
     */
    while (this.seamCanvases.length > list.length) this.seamCanvases.pop()?.remove();
    const night = this.look?.rc === 'night';
    list.forEach((sm, i) => {
      let c = this.seamCanvases[i];
      if (!c) {
        c = this.layer('rc-seams');
        c.hidden = false;
        this.seamCanvases.push(c);
      }
      const [ax, ay] = sm.vertical ? [sm.at, sm.s0] : [sm.s0, sm.at];
      const [bx, by] = sm.vertical ? [sm.at, sm.s1] : [sm.s1, sm.at];
      const g = this.fit(c, Math.floor(ax - SEAM_REACH), Math.floor(ay - SEAM_REACH), Math.ceil(bx + SEAM_REACH), Math.ceil(by + SEAM_REACH));
      if (!g) return;
      g.save();
      this.clipCovers(g, sm);
      this.paintSeam(g, sm, night);
      g.restore();
    });
  }

  /**
   * Leave out of what is drawn next every piece stacked over either of the two
   * a seam joins: the seams are one canvas over all the windows, and a window
   * opened or raised over a join would otherwise wear its pins and lozenges
   * across its own writing.
   */
  private clipCovers(g: CanvasRenderingContext2D, sm: Seam): void {
    const z = (el: HTMLElement): number => Number(getComputedStyle(el).zIndex) || 0;
    const a = this.all.find((d) => d.id === sm.a)?.el, b = this.all.find((d) => d.id === sm.b)?.el;
    if (!a || !b) return;
    const low = Math.min(z(a), z(b));
    const over = this.all.filter((d) => d.el !== a && d.el !== b && !d.el.hidden && z(d.el) > low);
    if (!over.length) return;
    g.beginPath();
    g.rect(0, 0, this.root.offsetWidth, this.root.offsetHeight);
    for (const d of over) {
      const at = this.place(d.el);
      g.rect(at.x, at.y, d.el.offsetWidth, d.el.offsetHeight);
    }
    g.clip('evenodd');
  }

  /** One seam, as `paintSeams` says. */
  private paintSeam(g: CanvasRenderingContext2D, sm: Seam, night: boolean): void {
    const soft = [this.kindOf(sm.a), this.kindOf(sm.b)].filter((k) => SOFT.has(k)).length;
    const pt = (t: number, d = 0): [number, number] => (sm.vertical ? [sm.at + d, t] : [t, sm.at + d]);
    const line = (d: number, wd: number, col: string): void => {
      g.beginPath();
      g.moveTo(...pt(sm.s0 + 6, d));
      g.lineTo(...pt(sm.s1 - 6, d));
      g.strokeStyle = col;
      g.lineWidth = wd;
      g.lineCap = 'round';
      g.stroke();
    };
    line(0, 5, 'rgba(38, 30, 26, 0.55)');
    line(-1.5, 1, night ? 'rgba(200, 210, 230, 0.35)' : 'rgba(255, 244, 220, 0.55)');
    if (soft === 0) {
      line(0, 2.2, night ? '#8f8a82' : '#cfc6b6');
      for (let t = sm.s0 + JOINT_EVERY / 2; t < sm.s1 - 12; t += JOINT_EVERY) {
        g.beginPath();
        g.moveTo(...pt(t, -6));
        g.lineTo(...pt(t, 6));
        g.strokeStyle = 'rgba(60, 52, 46, 0.7)';
        g.lineWidth = 1.4;
        g.stroke();
      }
    } else if (soft === 2) {
      for (let t = sm.s0 + 14; t < sm.s1 - 10; t += STITCH_EVERY) {
        for (const [a, b] of [[-5, 5], [5, -5]]) {
          for (const [col, wd] of [['rgba(40, 28, 20, 0.45)', 2.6], [night ? '#b9ad94' : '#efe2c4', 1.4]] as const) {
            g.beginPath();
            g.moveTo(...pt(t - 4, a));
            g.lineTo(...pt(t + 4, b));
            g.strokeStyle = col;
            g.lineWidth = wd;
            g.stroke();
          }
        }
      }
    } else {
      for (let t = sm.s0 + PIN_EVERY / 2; t < sm.s1 - 14; t += PIN_EVERY) {
        const [x, y] = pt(t);
        g.save();
        g.shadowColor = 'rgba(20, 14, 10, 0.5)';
        g.shadowBlur = 2;
        g.shadowOffsetY = 1;
        g.beginPath();
        g.arc(x, y, 4.2, 0, Math.PI * 2);
        g.fillStyle = gold(g, x - 4, y - 4, x + 4, y + 4, night);
        g.fill();
        g.restore();
        g.beginPath();
        g.arc(x, y, 4.2, 0, Math.PI * 2);
        g.strokeStyle = '#5b4220';
        g.lineWidth = 0.8;
        g.stroke();
        g.beginPath();
        g.arc(x - 1.2, y - 1.3, 1.2, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255, 250, 225, 0.9)';
        g.fill();
      }
    }
    for (const t of [sm.s0, sm.s1]) {
      const [x, y] = pt(t), r = 9;
      const lozenge = (s: number): void => {
        g.beginPath();
        g.moveTo(x, y - r * s);
        g.lineTo(x + r * 0.8 * s, y);
        g.lineTo(x, y + r * s);
        g.lineTo(x - r * 0.8 * s, y);
        g.closePath();
      };
      g.save();
      g.shadowColor = 'rgba(20, 14, 10, 0.5)';
      g.shadowBlur = 3;
      g.shadowOffsetY = 1;
      lozenge(1);
      g.fillStyle = gold(g, x - r, y - r, x + r, y + r, night);
      g.fill();
      g.restore();
      g.strokeStyle = '#5b4220';
      g.lineWidth = 0.9;
      g.stroke();
      lozenge(0.5);
      g.fillStyle = sm.vertical ? '#8fa6c4' : '#a7bcd6';
      g.fill();
    }
  }

  /** A glow running the length of each new seam once, over `GLINT_MS`. */
  private glint(fresh: Seam[]): void {
    const c = this.glintCanvas;
    const g = this.fit(c);
    if (!g) return;
    c.hidden = false;
    cancelAnimationFrame(this.glintFrame);
    const w = this.root.offsetWidth, h = this.root.offsetHeight;
    const start = performance.now();
    const frame = (now: number): void => {
      const u = Math.min(1, (now - start) / GLINT_MS);
      g.clearRect(0, 0, w, h);
      for (const sm of fresh) {
        const t = sm.s0 + (sm.s1 - sm.s0) * u;
        const [x, y] = sm.vertical ? [sm.at, t] : [t, sm.at];
        const r = 26, fade = 1 - u * 0.6, f = g.createRadialGradient(x, y, 0, x, y, r);
        f.addColorStop(0, `rgba(255, 246, 210, ${0.95 * fade})`);
        f.addColorStop(0.4, `rgba(255, 220, 140, ${0.45 * fade})`);
        f.addColorStop(1, 'rgba(255, 220, 140, 0)');
        g.save();
        this.clipCovers(g, sm);
        g.fillStyle = f;
        g.fillRect(x - r, y - r, r * 2, r * 2);
        g.restore();
      }
      if (u < 1) this.glintFrame = requestAnimationFrame(frame);
      else c.hidden = true;
    };
    this.glintFrame = requestAnimationFrame(frame);
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

  /** Put a frame's picture at the bottom of the interface, under everything else in it. */
  under(c: HTMLElement): void {
    this.root.prepend(c);
  }

  /** Dress something: `id` says which frame it wears (`frameFor`), `rim` how wide its rim is, `glyph` its window's rune, for its niche. */
  add(id: string, el: HTMLElement, rim: (kind: string) => number, glyph: string | null = null): void {
    const d = new Dressed(this, id, el, glyph, rim);
    this.all.push(d);
    d.refresh();
    if (glyph) new MutationObserver(() => this.wake()).observe(el, { attributes: true, attributeFilter: ['class', 'hidden'] });
  }

  /** Which window's rune breathes after dark: the front one's, drawn with the life on the frames (`LIFE_MS`). */
  private wake(): void {
    const night = this.look?.ui === 'runecut' && this.look.rc === 'night' && !reduced();
    const front = night ? this.all.find((d) => d.isFront) ?? null : null;
    if (front === this.breathing) return;
    const was = this.breathing;
    this.breathing = front;
    was?.still();
    front?.breathe(performance.now() / 1000);
  }
}
