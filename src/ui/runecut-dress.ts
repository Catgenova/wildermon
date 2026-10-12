import { frameFor, frameLamps, reachOf, NICHE_H, NICHE_W, paintFrame, paintNiche, paintNightGlow, paintPlate, seedOf, sideOf, type ArtOpts } from './runecut-art';
import { watchLook, type Look } from './theme';
import type { Join, Seam } from './snapgrid';

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
 * stopped, or the look changes. What moves: the front window's rune after
 * dark, breathing, and the motes off it, one small canvas a frame; and the
 * light of a lamp on a frame (`frameLamps`), a glow over the window's edge
 * and another under it past the edge, swelling and fading in CSS. Neither
 * moves under `prefers-reduced-motion`.
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

/** Frames of cloth, leather or paper; every other is hard (wood, stone, metal), for how a seam between two is fastened (`RunecutArt.paintSeams`). */
export const SOFT = new Set(['burlap', 'book', 'treasure']);
/** Along a seam: a cross-stitch, a mortar joint and a brass pin every so many interface px. */
export const STITCH_EVERY = 16;
export const JOINT_EVERY = 48;
export const PIN_EVERY = 40;
/** How long a new seam's glint takes to run its length. */
const GLINT_MS = 650;

function gold(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, night: boolean): CanvasGradient {
  const f = g.createLinearGradient(x0, y0, x1, y1);
  f.addColorStop(0, night ? '#d8c58e' : '#fbe7a6');
  f.addColorStop(0.45, night ? '#b8954c' : '#d9b25c');
  f.addColorStop(1, '#8e6526');
  return f;
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
  /** How far its frame stands past it (`reachOf`), for laying the frame's canvas under it. */
  private reach = 0;
  /** The glow of each lamp on its frame: over the window's edge, inside it, and under it past the edge, with where each lamp is on the window. */
  private lamps: Array<{ x: number; y: number; r: number; over: HTMLElement; under: HTMLElement }> = [];
  private readonly seed: number;
  /** The stretches of its sides another piece is joined along (`src/ui/snapgrid.ts`): no part of its frame stands past them. */
  private joins: Join[] = [];
  private joinsKey = '';
  /** Its frame with what stands past a join cut away: its own copy, so the picture in the cache stays whole. */
  private cut: HTMLCanvasElement | null = null;

  constructor(
    private readonly art: RunecutArt,
    readonly id: string,
    readonly el: HTMLElement,
    private readonly glyph: string | null,
    private readonly rimOf: (kind: string) => number,
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

  get isFront(): boolean {
    return this.el.classList.contains('win-front') && !this.el.hidden;
  }

  /** Paint, or take from the cache, everything for the look and size as they are, and lay it on. */
  refresh(): void {
    const look = this.art.look;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    if (!look || look.ui !== 'runecut' || this.el.hidden || !w || !h) {
      delete this.el.dataset.frame;
      this.lampsFor([], false);
      this.lay(null, null, null);
      return;
    }
    const k = (window.devicePixelRatio || 1) * this.art.scale();
    const night = look.rc === 'night';
    const kind = look.frames === 'themed' ? frameFor(this.id) : 'stone';
    // Which frame it wears, for the parts of the window itself that wear it too (src/style.css).
    if (this.el.dataset.frame !== kind) this.el.dataset.frame = kind;
    const rim = this.rimOf(kind);
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
    const plate = cachedCanvas(`plate|${this.id}|${kind}|${w}x${h}|${look.rc}|${kk}`, w, h, k, 'rc-plate', (g) => paintPlate(g, w, h, o));
    const R = reachOf(kind);
    this.reach = R;
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
      // The window clips what is in it at its padding edge, so the border's ring is drawn here, under it, and the hole is only the padding box.
      const W = w + 2 * R, H = h + 2 * R, bl = this.el.clientLeft, bt = this.el.clientTop;
      frame.style.clipPath = `path(evenodd, 'M0 0 H${W} V${H} H0 Z M${R + bl} ${R + bt} H${R + w - bl} V${R + h - bt} H${R + bl} Z')`;
    }
    this.edge = frame ? this.edgeOf(frame, w, h, k, R) : null;
    const laid = frame && this.joins.length ? this.cutOf(frame, w, h, k, R) : frame;
    this.lampsFor(frame ? frameLamps(kind, w, h, rim) : [], night);
    let niche: HTMLCanvasElement | null = null;
    if (this.glyph) {
      const glyph = this.glyph;
      niche = cachedCanvas(`niche|${kind === 'burlap' || kind === 'bench' || kind === 'runestone' || kind === 'parchment' || kind === 'treasure' || kind === 'wicker' || kind === 'ironbound' ? kind : ''}|${glyph}|${look.rc}|${kk}`, NICHE_W, NICHE_H, k, 'rc-niche', (g) => paintNiche(g, glyph, o, k));
      // A badge with no rune on it (`paintHammers`, `paintTablet`, `paintCompass`, `paintPaw`, `paintGear`) has nothing to breathe after dark.
      this.unlit = night && kind !== 'bench' && kind !== 'runestone' && kind !== 'parchment' && kind !== 'treasure' && kind !== 'wicker' && kind !== 'ironbound' ? cachedCanvas(`niche-unlit|${kind === 'burlap' ? kind : ''}|${glyph}|${kk}`, NICHE_W, NICHE_H, k, 'rc-niche', (g) => paintNiche(g, glyph, o, k, false)) : null;
      // The same picture serves every window with this rune, so each takes its own copy to show.
      niche = this.copyOf(niche);
    }
    this.lay(plate, laid, niche);
  }

  /**
   * Its frame with nothing standing past a stretch of side that another piece
   * is joined along, nor for a reach either way along it: the seam there is
   * the two of them, and a knob or a knot would lie across the neighbour.
   */
  private cutOf(src: HTMLCanvasElement, w: number, h: number, k: number, R: number): HTMLCanvasElement {
    let c = this.cut;
    if (!c) {
      c = document.createElement('canvas');
      this.cut = c;
    }
    c.className = src.className;
    c.dataset.frameFor = src.dataset.frameFor;
    c.dataset.frame = src.dataset.frame;
    c.style.clipPath = src.style.clipPath;
    c.width = src.width;
    c.height = src.height;
    c.style.width = src.style.width;
    c.style.height = src.style.height;
    const g = c.getContext('2d');
    if (!g) return src;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0);
    g.setTransform(k, 0, 0, k, R * k, R * k);
    g.globalCompositeOperation = 'destination-out';
    for (const j of this.joins) {
      const along = j.s1 - j.s0 + 2 * R;
      if (j.side === 'right') g.fillRect(w, j.s0 - R, R + 1, along);
      if (j.side === 'left') g.fillRect(-R - 1, j.s0 - R, R + 1, along);
      if (j.side === 'bottom') g.fillRect(j.s0 - R, h, along, R + 1);
      if (j.side === 'top') g.fillRect(j.s0 - R, -R - 1, along, R + 1);
    }
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  /** A glow for each lamp, made or kept; each swells in step with every other, on the page's own clock. */
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
          e.style.setProperty('--lamp-t', `${-Math.round(performance.now())}ms`);
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
  private edgeOf(src: HTMLCanvasElement, w: number, h: number, k: number, R: number): HTMLCanvasElement {
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
      g.drawImage(src, -R * k, -R * k);
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
    /*
     * A canvas inside the window is laid from its padding edge, inside the
     * window's border; everything is painted from its outer edge, as the
     * frame under it is laid. Back out by the border, so the two halves of a
     * frame meet on the same pixel and the slab is where its window is.
     */
    for (const c of [plate, this.edge]) {
      if (!c) continue;
      c.style.left = `${-this.el.clientLeft}px`;
      c.style.top = `${-this.el.clientTop}px`;
    }
    if (niche && !niche.isConnected) this.el.querySelector('.win-head')?.prepend(niche);
    if (frame && !frame.isConnected) this.art.under(frame);
    for (const l of this.lamps) {
      l.over.style.left = `${l.x - l.r - this.el.clientLeft}px`;
      l.over.style.top = `${l.y - l.r - this.el.clientTop}px`;
      if (l.over.parentElement !== this.el) this.el.append(l.over);
      // Just over its own frame, under every window.
      if (frame && l.under.previousElementSibling !== frame) frame.after(l.under);
    }
    this.place();
  }

  /** Called on any change to the element: shown or hidden, moved, restacked. */
  private follow(): void {
    if (this.el.hidden) {
      if (this.frame) this.frame.hidden = true;
      if (this.edge) this.edge.hidden = true;
      for (const l of this.lamps) l.under.hidden = true;
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
    for (const l of this.lamps) l.under.hidden = l.over.hidden = c.hidden;
    if (c.hidden) return;
    // Measured on the screen rather than by offsets, which leave out a transform such as the toolbar's centring.
    const at = this.art.place(this.el);
    c.style.left = `${at.x - this.reach}px`;
    c.style.top = `${at.y - this.reach}px`;
    for (const l of this.lamps) {
      l.under.style.left = `${at.x + l.x - l.r}px`;
      l.under.style.top = `${at.y + l.y - l.r}px`;
    }
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
    this.seamCanvas = this.layer('rc-seams');
    this.glintCanvas = this.layer('rc-glints');
    watchLook((look) => {
      this.look = look;
      for (const d of this.all) d.refresh();
      this.paintSeams();
      this.wake();
    });
    // The interface's own scale, which the canvases are drawn at, moves with the screen and the size setting.
    window.addEventListener('resize', () => {
      for (const d of this.all) d.refresh();
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

  private readonly seamCanvas: HTMLCanvasElement;
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

  private fit(c: HTMLCanvasElement): CanvasRenderingContext2D | null {
    const w = this.root.offsetWidth, h = this.root.offsetHeight;
    const k = (window.devicePixelRatio || 1) * this.scale();
    c.width = Math.max(1, Math.ceil(w * k));
    c.height = Math.max(1, Math.ceil(h * k));
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const g = c.getContext('2d');
    g?.setTransform(k, 0, 0, k, 0, 0);
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
    const c = this.seamCanvas;
    const on = this.look?.ui === 'runecut' && this.seamsShown && this.seamList.length > 0;
    c.hidden = !on;
    if (!on) return;
    const g = this.fit(c);
    if (!g) return;
    const night = this.look?.rc === 'night';
    for (const sm of this.seamList) {
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
        g.fillStyle = f;
        g.fillRect(x - r, y - r, r * 2, r * 2);
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

  /** Put a frame canvas at the bottom of the interface, under everything else in it. */
  under(c: HTMLCanvasElement): void {
    this.root.prepend(c);
  }

  /** Dress something: `id` says which frame it wears (`frameFor`), `rim` how wide its rim is, `glyph` its window's rune, for its niche. */
  add(id: string, el: HTMLElement, rim: (kind: string) => number, glyph: string | null = null): void {
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
