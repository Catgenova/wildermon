import { uiBox, uiFitted, uiFloor, uiPoint } from './screen';
import { LAYOUT_NAMES } from '../game/keybinds';
import { runeFor, runeSvg } from './theme';
import { CELL, CELL_MAJOR, cells, clearPatch, fits, joinsOf, onScreen, placeFor, seamKey, seamsOf, sizeFor, snap, snapAt, squeezeFor, type Box, type Join, type Seam } from './snapgrid';

export type Anchor = 'tl' | 'tr' | 'bl' | 'br';

export interface WindowOptions {
  id: string;
  title: string;
  /** Offset from the anchor corner of the viewport. */
  x: number;
  y: number;
  width: number;
  height: number;
  anchor?: Anchor;
  open?: boolean;
  /**
   * Whether it can be made see-through: dimmed, with clicks on it going to the
   * island underneath, and only its title bar still taking hold of it. For the
   * windows that are read rather than worked in -- the tracker, the event log,
   * the map -- which otherwise cover a piece of the island for good.
   */
  seeThrough?: boolean;
  /** Put somewhere of its own each time it is made, rather than where it was left: the tally of what happened while you were away. */
  fresh?: boolean;
}

interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SavedState extends Geometry {
  open: boolean;
  /** Expanded to (nearly) the whole viewport; x/y/w/h hold the geometry to restore. */
  max?: boolean;
  /** See-through (`WindowOptions.seeThrough`). */
  see?: boolean;
  /** Its box on the grid, rim and all (`UIWindow.want`). */
  ow?: number;
  oh?: number;
}

/** One saved arrangement of every window: where each is, how big, and whether it is open. */
export interface Layout {
  name: string;
  windows: Record<string, SavedState>;
}

const STORAGE_KEY = 'wurm-iso-windows';
const LAYOUT_KEY = 'wurm-iso-layouts';
const EXPAND_ICON = '⤢';
const RESTORE_ICON = '⤡';
const SEE_ICON = '◐';

/** How close, in interface pixels, an edge used to have to come to another before a drag put it against it (news 136); windows go on the grid now (`src/ui/snapgrid.ts`). */
export const SNAP = 10;
/** How far, in interface pixels, a press on the status panel or the toolbar has to travel before it is a drag rather than a click. */
const BAR_DRAG = 6;
/** On a phone, the least room between the toolbar and the status panel under it (`WindowManager.stackBars`). */
const BAR_GAP = 4;
/** On a phone, the room left between a window's foot and the event log, the first-steps card or the spell bar under it. */
const FOOT_GAP = 8;
/** On a phone, the least height worth keeping windows to between the bars and the foot (a title and four rows); with less, they may lie over the foot's things. */
const MIN_BAND = 160;
/** Windows are raised by z-index from here; past `Z_TOP` they are counted down again, keeping them under the seams (`.rc-seams`, src/style.css). */
const Z_FLOOR = 100;
const Z_TOP = 5000;
/** The arrangements of windows kept, each called back with a key of its own (`layout_1`…). */
export const LAYOUT_SLOTS = LAYOUT_NAMES.length;
/** Windows that are never part of an arrangement, because they are opened by something happening rather than by you. */
const NOT_LAID_OUT = new Set(['away', 'hoard', 'barter']);

/** Something laid on the grid: a window, or the status panel or toolbar, which are always on screen. */
interface Piece {
  readonly id: string;
  readonly el: HTMLElement;
  /** Never resized or closed: the status panel and the toolbar. */
  readonly fixed: boolean;
  /** On screen and taking up its room: a window open and not expanded, or a bar. */
  readonly placed: boolean;
  /** Its box, rim and all, in interface pixels. */
  box(): Box;
  /**
   * Put it on a box: a window takes the place and the size, a bar only the
   * place. `kept`: a size chosen, by a resize or a layout, rather than rounded
   * to the grid. `own`: the size it is meant to be, kept for later when it is
   * put on a smaller box for want of room.
   */
  put(b: Box, kept?: boolean, own?: { w: number; h: number }): void;
  /** The size it is meant to be on the grid, if one was chosen (`UIWindow.want`). */
  readonly wanted?: { w: number; h: number } | null;
  /** The smallest it may be made, in whole cells. */
  least(): { w: number; h: number };
}

/** A draggable, resizable overlay window in the Wurm style. */
export class UIWindow implements Piece {
  readonly fixed = false;
  readonly el: HTMLDivElement;
  readonly body: HTMLDivElement;
  readonly titleText: HTMLSpanElement;
  private readonly expandBtn: HTMLButtonElement;
  private readonly seeBtn: HTMLButtonElement | null = null;
  private maximized = false;
  private see = false;
  /** Geometry to go back to when the window is restored from expanded. */
  private normal: Geometry | null = null;
  /**
   * The size of its box on the grid, rim and all, once that has been chosen
   * by a resize or kept from before: held to when its rim changes under it
   * (Runecut's frames are put on after a window is made, and a closed one's
   * when it opens), so the box stays the same cells and the room inside
   * gives or takes the difference. Until then it is rounded to the grid
   * from whatever size it is.
   */
  private want: { w: number; h: number } | null = null;

  constructor(
    private readonly mgr: WindowManager,
    readonly opts: WindowOptions,
    saved: SavedState | undefined,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'win';
    this.el.dataset.id = opts.id;
    const title = document.createElement('div');
    title.className = 'win-title';
    this.titleText = document.createElement('span');
    this.titleText.className = 'win-title-text';
    this.titleText.textContent = opts.title;
    const buttons = document.createElement('span');
    buttons.className = 'win-buttons';
    this.expandBtn = document.createElement('button');
    this.expandBtn.className = 'win-btn win-expand';
    this.expandBtn.type = 'button';
    this.expandBtn.title = 'Expand';
    this.expandBtn.setAttribute('aria-label', 'Expand');
    this.expandBtn.textContent = EXPAND_ICON;
    this.expandBtn.addEventListener('click', () => this.toggleMaximized());
    const close = document.createElement('button');
    close.className = 'win-btn win-close';
    close.type = 'button';
    close.title = 'Close';
    // The buttons are drawn as signs; a screen reader says what they do instead.
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => this.close());
    if (opts.seeThrough) {
      const see = document.createElement('button');
      see.className = 'win-btn win-see-btn';
      see.type = 'button';
      see.textContent = SEE_ICON;
      see.setAttribute('aria-label', 'See-through');
      see.addEventListener('click', () => this.setSeeThrough(!this.see));
      this.seeBtn = see;
      buttons.append(see);
    }
    buttons.append(this.expandBtn, close);
    // The window's rune, cut at the head of the title in Runecut and not shown in Classic (src/style.css).
    const rune = runeSvg(runeFor(opts.id), 'rc-rune win-rune');
    const head = document.createElement('span');
    head.className = 'win-head';
    head.append(rune, this.titleText);
    title.append(head, buttons);
    this.body = document.createElement('div');
    this.body.className = 'win-body';
    // Resized from its bottom-right corner, onto whole cells (`WindowManager.begin`); a phone's windows are not resized.
    const grip = document.createElement('div');
    grip.className = 'win-grip';
    grip.title = 'Drag to resize';
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.maximized) return;
      e.preventDefault();
      e.stopPropagation();
      this.mgr.bringToFront(this);
      this.mgr.begin(this, 'size', e, grip);
    });
    this.el.append(title, this.body, grip);

    // Never start larger than the screen, whatever the saved layout says.
    const w = Math.min(saved?.w ?? opts.width, Math.max(160, uiBox().w - 16));
    const h = Math.min(saved?.h ?? opts.height, Math.max(70, uiBox().h - 16));
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
    if (saved) {
      this.el.style.left = `${saved.x}px`;
      this.el.style.top = `${saved.y}px`;
    } else {
      const anchor = opts.anchor ?? 'tl';
      const left = anchor === 'tr' || anchor === 'br' ? uiBox().w - w - opts.x : opts.x;
      const top = anchor === 'bl' || anchor === 'br' ? uiBox().h - h - opts.y : opts.y;
      this.el.style.left = `${left}px`;
      this.el.style.top = `${top}px`;
    }
    this.el.hidden = !(saved?.open ?? opts.open ?? true);
    if (saved?.ow && saved?.oh) this.want = { w: saved.ow, h: saved.oh };
    if (saved?.max) this.setMaximized(true, false);
    this.setSeeThrough(!!(opts.seeThrough && saved?.see), false);

    // On the grid a window is moved by `WindowManager.begin`; on a phone, where windows are as wide as the screen, only up and down.
    let drag: { dx: number; dy: number } | null = null;
    title.addEventListener('pointerdown', (e) => {
      if (buttons.contains(e.target as Node) || e.button !== 0 || this.maximized) return;
      e.preventDefault();
      if (this.mgr.grid) {
        this.mgr.bringToFront(this);
        this.mgr.begin(this, 'move', e, title);
        return;
      }
      const at = uiPoint(e);
      drag = { dx: at.x - this.el.offsetLeft, dy: at.y - this.el.offsetTop };
      title.setPointerCapture(e.pointerId);
    });
    title.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const at = uiPoint(e);
      this.el.style.left = `${at.x - drag.dx}px`;
      this.el.style.top = `${at.y - drag.dy}px`;
      this.clamp();
    });
    title.addEventListener('pointerup', (e) => {
      if (!drag) return;
      drag = null;
      title.releasePointerCapture(e.pointerId);
      this.mgr.persist();
    });
    title.addEventListener('dblclick', (e) => {
      if (buttons.contains(e.target as Node)) return;
      this.toggleMaximized();
    });
    this.el.addEventListener('mousedown', () => this.mgr.bringToFront(this));
    this.el.addEventListener('mouseup', () => this.mgr.persist());
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  get isMaximized(): boolean {
    return this.maximized;
  }

  get isSeeThrough(): boolean {
    return this.see;
  }

  get id(): string {
    return this.opts.id;
  }

  get placed(): boolean {
    return this.isOpen && !this.maximized;
  }

  /** Kept to the foot of the screen (anchored at a bottom corner): the event log. On a phone the other windows stay above it (`WindowManager.footFor`). */
  get atFoot(): boolean {
    return this.opts.anchor === 'bl' || this.opts.anchor === 'br';
  }

  box(): Box {
    return { x: this.el.offsetLeft, y: this.el.offsetTop, w: this.el.offsetWidth, h: this.el.offsetHeight };
  }

  get wanted(): { w: number; h: number } | null {
    return this.want;
  }

  /** Its place and its box's size; the size it is given is the box less its rim (`frame`). */
  put(b: Box, kept = false, own?: { w: number; h: number }): void {
    const [fw, fh] = this.frame();
    this.applyGeometry({ x: b.x, y: b.y, w: b.w - fw, h: b.h - fh });
    if (own) this.want = { w: own.w, h: own.h };
    else if (kept || this.want) this.want = { w: b.w, h: b.h };
  }

  /** The least a window may be (`.win` in src/style.css), rim and all, in whole cells. */
  least(): { w: number; h: number } {
    const [fw, fh] = this.frame();
    return { w: cells(160 + fw), h: cells(70 + fh) };
  }

  /**
   * See-through or solid. See-through, the window is dimmed and the island
   * takes every click that lands on it but the title bar's, so it can sit over
   * the ground you are working; holding Alt makes it solid again for as long
   * as Alt is down (`WindowManager`), to scroll it or click in it.
   */
  setSeeThrough(on: boolean, persist = true): void {
    if (!this.opts.seeThrough) return;
    this.see = on;
    this.el.classList.toggle('win-see', on);
    if (this.seeBtn) {
      this.seeBtn.classList.toggle('win-btn-on', on);
      this.seeBtn.setAttribute('aria-pressed', String(on));
      this.seeBtn.title = on
        ? 'Solid again. While it is see-through, hold Alt to click in it.'
        : 'See-through: dimmed, and clicks on it go to the island. Hold Alt to click in it.';
    }
    if (persist) this.mgr.persist();
  }

  /** Put the window where a saved arrangement has it: its place, its size, open or shut, expanded or not. */
  apply(st: SavedState): void {
    if (this.maximized) this.setMaximized(false, false);
    this.applyGeometry(st);
    this.want = st.ow && st.oh ? { w: st.ow, h: st.oh } : null;
    if (st.max) this.setMaximized(true, false);
    if (st.see !== undefined) this.setSeeThrough(st.see, false);
    const was = this.isOpen;
    this.el.hidden = !st.open;
    if (st.open) {
      this.clamp();
      if (!was) {
        this.mgr.bringToFront(this);
        this.onOpen?.();
      }
    }
  }

  /**
   * Back to the place and size kept for it, open or shut as it is now: laid
   * again once the interface has its real size (`WindowManager.clampAll`).
   */
  relay(st: SavedState): void {
    if (this.maximized || st.max || this.opts.fresh) return;
    this.applyGeometry(st);
    this.want = st.ow && st.oh ? { w: st.ow, h: st.oh } : null;
  }

  /** Raise above the other windows. */
  focus(): void {
    this.mgr.bringToFront(this);
  }

  toggleMaximized(): void {
    this.setMaximized(!this.maximized);
  }

  /** Expand to nearly the whole viewport, or go back to the previous size and place. */
  setMaximized(on: boolean, persist = true): void {
    if (on === this.maximized) return;
    this.maximized = on;
    if (on) {
      this.normal = this.geometry();
      this.el.classList.add('maximized');
      this.applyMaximized();
      this.expandBtn.textContent = RESTORE_ICON;
      this.expandBtn.title = 'Restore';
      this.expandBtn.setAttribute('aria-label', 'Restore');
      this.mgr.bringToFront(this);
    } else {
      this.el.classList.remove('maximized');
      if (this.normal) this.applyGeometry(this.normal);
      this.expandBtn.textContent = EXPAND_ICON;
      this.expandBtn.title = 'Expand';
      this.expandBtn.setAttribute('aria-label', 'Expand');
      this.clamp();
    }
    if (persist) {
      // Back from expanded, it goes on the grid again where there is room; while expanded it is over the rest, and the seams are put away.
      if (!on) this.mgr.settle(this);
      this.mgr.rejoin(false);
      this.mgr.persist();
    }
  }

  private applyMaximized(): void {
    this.el.style.maxHeight = '';
    const margin = Math.max(8, Math.round(Math.min(uiBox().w, uiBox().h) * 0.04));
    const [fw, fh] = this.frame();
    this.applyGeometry({
      x: margin,
      y: margin,
      w: Math.max(160, uiBox().w - margin * 2 - fw),
      h: Math.max(70, uiBox().h - margin * 2 - fh),
    });
  }

  /**
   * How much the window's box is bigger than the size it is given, across and
   * down. Nothing in Classic; in Runecut, its stone rim, which is added round
   * the size a window is given rather than taken out of it, so a window's
   * content is as big in either look and a saved layout keeps its content's
   * size (`.win` in src/style.css). What fits the screen is the whole box.
   */
  private frame(): [number, number] {
    const w = parseFloat(this.el.style.width), h = parseFloat(this.el.style.height);
    return [w ? Math.max(0, this.el.offsetWidth - w) : 0, h ? Math.max(0, this.el.offsetHeight - h) : 0];
  }

  private applyGeometry(g: Geometry): void {
    this.el.style.left = `${g.x}px`;
    this.el.style.top = `${g.y}px`;
    this.el.style.width = `${g.w}px`;
    this.el.style.height = `${g.h}px`;
  }

  /** Current place and size from the inline styles, which drag, resize and code all write. */
  private geometry(): Geometry {
    return {
      x: parseFloat(this.el.style.left) || 0,
      y: parseFloat(this.el.style.top) || 0,
      w: parseFloat(this.el.style.width) || this.opts.width,
      h: parseFloat(this.el.style.height) || this.opts.height,
    };
  }

  /** Called whenever the window is shown, so a panel can bring itself up to date. */
  onOpen: (() => void) | null = null;

  open(): void {
    this.el.hidden = false;
    this.mgr.bringToFront(this);
    // On a phone a window at the foot opening moves the others' foot up, so all are laid again.
    if (this.mgr.grid) this.clamp();
    else this.mgr.clampAll();
    // Where it was, unless something has taken that room since: then the nearest free room of its size.
    this.mgr.settle(this);
    this.mgr.rejoin(false);
    this.onOpen?.();
    this.mgr.persist();
  }

  close(): void {
    this.el.hidden = true;
    if (!this.mgr.grid && this.atFoot) this.mgr.clampAll();
    this.mgr.rejoin(false);
    this.mgr.persist();
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Keep every window wholly inside the interface, on every screen. */
  clamp(): void {
    if (this.el.hidden) return;
    if (this.maximized) {
      this.applyMaximized();
      return;
    }
    const box = uiBox();
    const floor = uiFloor();

    /*
     * Nothing goes off the edge, and nothing is bigger than the room it is in.
     *
     * A window used to be allowed to hang over an edge with sixty pixels of
     * itself left showing — or, at the bottom of a desktop, thirty — on the
     * grounds that somebody might want one mostly out of the way and could
     * always drag it back by the title bar. What it actually produced was the
     * event window three quarters off the left of a phone, with its tabs and
     * its "Find…" box out in the dark, and a drag handle you would have to
     * reach past the screen to take hold of. A window you cannot get back is
     * not tidied away, it is lost.
     *
     * Size first, because a window wider or taller than the interface cannot
     * be put inside it however it is moved, and then the position against what
     * that leaves. The same pass runs on every open, every drag, every resize
     * and every turn of the phone, so a window saved from a wide screen and
     * opened on a narrow one comes back in rather than off the side.
     */
    /*
     * On a phone, as high as the room between the bars and whatever holds the
     * foot of the screen (`WindowManager.footFor`), given as a most rather
     * than written over its height, so the size it was given comes back on a
     * wider screen or once that room grows.
     */
    const foot = this.mgr.grid ? box.h : this.mgr.footFor(this);
    const room = Math.max(70, foot - floor - (foot === box.h ? 12 : 0));
    this.el.style.maxHeight = this.mgr.grid ? '' : `${room}px`;
    const [fw, fh] = this.frame();
    if (this.el.offsetHeight > room) this.el.style.height = `${room - fh}px`;
    const wide = Math.max(160, box.w - 12);
    if (this.el.offsetWidth > wide) this.el.style.width = `${wide - fw}px`;

    const maxLeft = Math.max(0, box.w - this.el.offsetWidth);
    const maxTop = Math.max(floor, foot - this.el.offsetHeight);
    this.el.style.left = `${Math.min(maxLeft, Math.max(0, this.el.offsetLeft))}px`;
    this.el.style.top = `${Math.min(maxTop, Math.max(floor, this.el.offsetTop))}px`;
  }

  state(): SavedState {
    const g = this.maximized && this.normal ? this.normal : this.geometry();
    // An open window on the grid keeps its box's cells, so the next time it is made it is made that size whatever rim it is given first.
    if (!this.want && this.mgr.grid && this.placed) {
      const b = this.box();
      const { w, h } = uiBox();
      if (b.w && b.h && fits(b.x, b.w, w) && fits(b.y, b.h, h)) this.want = { w: b.w, h: b.h };
    }
    return {
      ...g,
      open: this.isOpen,
      max: this.maximized,
      ...(this.opts.seeThrough ? { see: this.see } : {}),
      ...(this.want ? { ow: this.want.w, oh: this.want.h } : {}),
    };
  }
}

/**
 * The status panel or the toolbar as a piece on the grid: always on screen,
 * moved by pressing anywhere on it and dragging (a press that does not travel
 * is a click on whatever it landed on), never resized or closed. Whole cells
 * big, by being made at least that big: what is in it sits at its top left,
 * or in the middle of the toolbar.
 */
export class Bar implements Piece {
  readonly fixed = true;
  readonly placed = true;

  constructor(
    private readonly mgr: WindowManager,
    readonly id: string,
    readonly el: HTMLElement,
  ) {
    let press: { x: number; y: number; e: PointerEvent } | null = null;
    // A press that became a drag makes no click on the button it started on.
    let dragged = false;
    el.addEventListener('click', (c) => {
      if (!dragged) return;
      dragged = false;
      c.stopPropagation();
      c.preventDefault();
    }, { capture: true });
    el.addEventListener('pointerdown', (e) => {
      dragged = false;
      if (e.button !== 0 || !this.mgr.grid) return;
      press = { ...uiPoint(e), e };
    });
    el.addEventListener('pointermove', (e) => {
      if (!press) return;
      const at = uiPoint(e);
      if (Math.hypot(at.x - press.x, at.y - press.y) < BAR_DRAG) return;
      const from = press.e;
      press = null;
      dragged = true;
      this.mgr.begin(this, 'move', from, el);
    });
    const lift = (): void => {
      press = null;
    };
    el.addEventListener('pointerup', lift);
    el.addEventListener('pointercancel', lift);
    // What is in it grows and shrinks (a companion, a wound, a key rebound): it is made whole cells again, and windows it now covers move off it.
    new ResizeObserver(() => {
      if (this.mgr.grid && !this.fitting && this.el.offsetWidth % CELL + this.el.offsetHeight % CELL !== 0) this.mgr.settleAll();
      // On a phone, a bar grown taller (the toolbar onto a second row) moves the ones under it down, and the windows under them.
      else if (!this.mgr.grid) this.mgr.clampAll();
    }).observe(el);
  }

  private fitting = false;

  box(): Box {
    return { x: this.el.offsetLeft, y: this.el.offsetTop, w: this.el.offsetWidth, h: this.el.offsetHeight };
  }

  put(b: Box): void {
    this.el.style.left = `${b.x}px`;
    this.el.style.top = `${b.y}px`;
  }

  least(): { w: number; h: number } {
    const b = this.box();
    return { w: b.w, h: b.h };
  }

  /** Made the size of what is in it, up to whole cells. */
  fit(): void {
    this.fitting = true;
    const s = this.el.style;
    s.minWidth = s.minHeight = '';
    const w = cells(this.el.offsetWidth), h = cells(this.el.offsetHeight);
    s.minWidth = `${w}px`;
    s.minHeight = `${h}px`;
    // Whatever its box-sizing, it comes out at the size asked for.
    const dw = w - this.el.offsetWidth, dh = h - this.el.offsetHeight;
    if (dw) s.minWidth = `${w + dw}px`;
    if (dh) s.minHeight = `${h + dh}px`;
    this.fitting = false;
  }

  /** Back to the look's own place and size, off the grid: a phone's screen. */
  loose(): void {
    const s = this.el.style;
    s.left = s.top = s.minWidth = s.minHeight = '';
  }
}

/** A move or a resize under way: the piece, where the pointer started, where it was, and where it will land. */
interface Drag {
  p: Piece;
  kind: 'move' | 'size';
  x0: number;
  y0: number;
  from: Box;
  to: Box;
  /** The seams there were when it started, so the ones it makes are the ones that are new. */
  before: Set<string>;
}

export class WindowManager {
  readonly windows = new Map<string, UIWindow>();
  /** The status panel and the toolbar. */
  readonly bars = new Map<string, Bar>();
  private z = Z_FLOOR;
  private saved: Record<string, SavedState> = {};
  /** The kept arrangements, one a slot, null where nothing has been kept yet. */
  private layouts: Array<Layout | null> = [];
  /** The grid, drawn while something is being moved or resized; and where it will land. */
  private readonly gridCanvas: HTMLCanvasElement;
  private readonly ghost: HTMLDivElement;
  private drag: Drag | null = null;
  /** The seams as they were last laid, by `seamKey`. */
  private seamKeys = new Set<string>();
  /**
   * Whether anything has been moved, resized, opened or shut since the page
   * was loaded. Until then what was kept is what the windows are, and they
   * are laid from it again whenever the interface changes size; nothing is
   * written over it by the windows being placed, measured and dressed as the
   * page comes up, each of which would put them on the grid a cell off from
   * where they were left.
   */
  private touched = false;

  constructor(readonly root: HTMLElement) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.saved = JSON.parse(raw) as Record<string, SavedState>;
    } catch {
      this.saved = {};
    }
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      const got = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(got)) this.layouts = got.map((l) => (l && typeof l === 'object' && typeof (l as Layout).name === 'string' && (l as Layout).windows ? (l as Layout) : null));
    } catch {
      this.layouts = [];
    }
    this.gridCanvas = document.createElement('canvas');
    this.gridCanvas.className = 'snap-grid';
    this.gridCanvas.hidden = true;
    this.ghost = document.createElement('div');
    this.ghost.className = 'snap-ghost';
    this.ghost.hidden = true;
    root.append(this.gridCanvas, this.ghost);
    window.addEventListener('resize', () => this.clampAll());
    // Written as the page goes, too, so a close or a refresh keeps what is on the screen.
    window.addEventListener('pagehide', () => {
      if (this.touched) this.persist();
    });
    /*
     * Alt held makes every see-through window solid for as long as it is down:
     * the one way to scroll a see-through log or click a line in it without
     * making it solid and see-through again.
     */
    const alt = (on: boolean): void => {
      root.classList.toggle('alt-held', on);
    };
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Alt') alt(true);
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Alt') alt(false);
    });
    window.addEventListener('blur', () => alt(false));
  }

  /**
   * Whether the interface is on the grid: everywhere but a phone's screen,
   * where every window is as wide as the screen and the status panel and
   * toolbar have their own places (`#ui.narrow` in src/style.css).
   */
  get grid(): boolean {
    return !this.root.classList.contains('narrow');
  }

  /** Every piece on the grid: the bars, then the windows. */
  private pieces(): Piece[] {
    return [...this.bars.values(), ...this.windows.values()];
  }

  /** What a piece may not cover: the clear patch round your character, and every other piece on screen. */
  private walls(p: Piece | null): Box[] {
    const { w, h } = uiBox();
    return [clearPatch(w, h), ...this.pieces().filter((q) => q !== p && q.placed).map((q) => q.box())];
  }

  /**
   * Put one piece on the grid among the rest: whole cells big (a window no
   * bigger than the screen), on whole cells, on the screen, and where that
   * covers something, in the nearest free room of its size. With no room
   * anywhere it stays where it is, on the grid.
   */
  settle(p: Piece, walls: Box[] = this.walls(p)): void {
    if (!this.grid || !p.placed) return;
    const { w: sw, h: sh } = uiBox();
    let b = p.box();
    if (!p.fixed) {
      const m = p.least();
      const want = p.wanted ?? b;
      // Whole cells, or out to the screen's far edge if that is where it reached (`fits`).
      const size = (v: number, at: number, span: number): number => Math.min(fits(at, v, span) ? v : snap(v), span);
      b = { ...b, w: Math.max(m.w, size(want.w, b.x, sw)), h: Math.max(m.h, size(want.h, b.y, sh)) };
    }
    b = onScreen({ ...b, x: snapAt(b.x, b.w, sw), y: snapAt(b.y, b.h, sh) }, sw, sh);
    const room = placeFor(b, walls, sw, sh)?.r;
    if (room || p.fixed) {
      p.put(room ?? b);
      return;
    }
    // No room its size anywhere: as big as the room there is, its own size kept for when room comes back.
    const less = squeezeFor(b, p.least(), walls, sw, sh);
    if (less) p.put(less, false, { w: b.w, h: b.h });
    else p.put(b);
  }

  /**
   * Every piece on the grid, the bars first and then the windows from the
   * front back, each taking the room it has unless one before it took it.
   * Off the grid, on a phone, the bars go back to their own places.
   */
  settleAll(): void {
    if (this.drag) return;
    this.root.classList.toggle('snapgrid', this.grid);
    if (!this.grid) {
      this.stackBars();
      this.rejoin(false);
      return;
    }
    const { w, h } = uiBox();
    const walls = [clearPatch(w, h)];
    for (const b of this.bars.values()) {
      b.fit();
      this.settle(b, walls);
      walls.push(b.box());
    }
    const open = [...this.windows.values()].filter((win) => win.placed).sort((a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex));
    for (const win of open) {
      this.settle(win, walls);
      walls.push(win.box());
    }
    this.rejoin(false);
  }

  /**
   * Take hold of a piece to move it or, from its corner, resize it. The grid
   * shows until it is let go, with the room it will land in outlined; a
   * window being moved follows the pointer and drops into that room.
   */
  begin(p: Piece, kind: 'move' | 'size', e: PointerEvent, handle: HTMLElement): void {
    if (!this.grid || this.drag) return;
    const at = uiPoint(e);
    const from = p.box();
    this.drag = { p, kind, x0: at.x, y0: at.y, from, to: from, before: new Set(this.seamKeys) };
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // A pointer already let go of; the drag ends on the next move or release.
    }
    p.el.classList.add('snap-moving');
    this.drawGrid();
    this.showGhost(from);
    // While it is held it is joined to nothing, and its neighbours have their whole frames back.
    this.rejoin(false, p);
    const move = (ev: PointerEvent): void => this.moveTo(ev);
    const up = (): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      this.end();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  private moveTo(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const at = uiPoint(e);
    const dx = at.x - d.x0, dy = at.y - d.y0;
    const { w, h } = uiBox();
    const walls = this.walls(d.p);
    if (d.kind === 'move') {
      const loose = { ...d.from, x: d.from.x + dx, y: d.from.y + dy };
      d.p.el.style.left = `${loose.x}px`;
      d.p.el.style.top = `${loose.y}px`;
      d.to = placeFor(loose, walls, w, h)?.r ?? d.from;
    } else {
      d.to = sizeFor(d.from, d.from.w + dx, d.from.h + dy, d.p.least(), walls, w, h).r;
      d.p.put(d.to, true);
    }
    this.showGhost(d.to);
  }

  private end(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.p.put(d.to, d.kind === 'size');
    // Laid as it will be when the page is next loaded, so it comes back the same: a box that sat against the screen's far edge, off the grid there, is whole cells again once moved or resized away from it.
    this.settle(d.p);
    d.p.el.classList.remove('snap-moving');
    this.gridCanvas.hidden = true;
    this.ghost.hidden = true;
    this.rejoin(true, null, d.before);
    this.persist();
  }

  private showGhost(b: Box): void {
    Object.assign(this.ghost.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
    this.ghost.hidden = false;
  }

  /** The grid over the island: a line every cell and a heavier one every few, none in the clear patch, whose edge is marked. */
  private drawGrid(): void {
    const c = this.gridCanvas;
    const { w, h } = uiBox();
    const k = (window.devicePixelRatio || 1) * (this.root.offsetWidth ? this.root.getBoundingClientRect().width / this.root.offsetWidth : 1);
    c.width = Math.ceil(w * k);
    c.height = Math.ceil(h * k);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, w, h);
    const lines = (major: boolean, colour: string, width: number, off: number): void => {
      g.beginPath();
      for (let x = 0; x <= w; x += CELL) if ((x % (CELL * CELL_MAJOR) === 0) === major) g.rect(x + off - width / 2, 0, width, h);
      for (let y = 0; y <= h; y += CELL) if ((y % (CELL * CELL_MAJOR) === 0) === major) g.rect(0, y + off - width / 2, w, width);
      g.fillStyle = colour;
      g.fill();
    };
    // A dark line under each pale one, so the grid shows over snow and sea alike.
    lines(false, 'rgba(20, 16, 12, 0.22)', 1, 1);
    lines(false, 'rgba(255, 246, 225, 0.26)', 1, 0);
    lines(true, 'rgba(20, 16, 12, 0.3)', 1.5, 1);
    lines(true, 'rgba(255, 246, 225, 0.5)', 1.5, 0);
    const z = clearPatch(w, h);
    g.clearRect(z.x - 1, z.y - 1, z.w + 2, z.h + 2);
    g.setLineDash([6, 5]);
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(255, 246, 225, 0.75)';
    g.strokeRect(z.x + 0.75, z.y + 0.75, z.w - 1.5, z.h - 1.5);
    g.setLineDash([]);
    g.font = '600 12px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(20, 16, 12, 0.55)';
    g.fillText('Kept clear', z.x + z.w / 2 + 1, z.y + z.h - 9);
    g.fillStyle = 'rgba(255, 246, 225, 0.9)';
    g.fillText('Kept clear', z.x + z.w / 2, z.y + z.h - 10);
    c.hidden = false;
  }

  /**
   * Lay the seams: every stretch of edge two pieces on screen share, and
   * along each, the stretches of each piece's own sides that touch a
   * neighbour. `onSeams` draws them (Runecut, `src/ui/runecut-dress.ts`).
   * With `glint`, the ones that are new since `before` are marked, and
   * `onJoin` sounds once if there are any. `skip`, a piece being held, is
   * joined to nothing.
   */
  rejoin(glint: boolean, skip: Piece | null = null, before: Set<string> = this.seamKeys): void {
    const on = this.grid ? this.pieces().filter((p) => p.placed && p !== skip).map((p) => ({ id: p.id, box: p.box() })) : [];
    const seams = seamsOf(on);
    const joins = new Map<string, Join[]>();
    for (const p of this.pieces()) joins.set(p.id, []);
    for (const p of on) joins.set(p.id, joinsOf(p.id, p.box, seams));
    const fresh = glint ? seams.filter((s) => !before.has(seamKey(s))) : [];
    this.seamKeys = new Set(seams.map(seamKey));
    // An expanded window is over the rest, and seams drawn over it would be on it.
    const shown = ![...this.windows.values()].some((w) => w.isOpen && w.isMaximized);
    this.onSeams?.(seams, joins, fresh, shown);
    if (fresh.length) this.onJoin?.();
  }

  /** Told of the seams each time they are laid (`rejoin`). */
  onSeams: ((seams: Seam[], joins: Map<string, Join[]>, fresh: Seam[], shown: boolean) => void) | null = null;
  /** Told when a move or a resize has made a new join: a click (`Sound.join`). */
  onJoin: (() => void) | null = null;

  /** Put the status panel or the toolbar on the grid, where it was kept or, the first time, at `at`. */
  addBar(id: string, el: HTMLElement, at: (b: Box) => { x: number; y: number }): Bar {
    const bar = new Bar(this, id, el);
    this.bars.set(id, bar);
    if (this.grid) {
      this.root.classList.add('snapgrid');
      bar.fit();
      const kept = this.saved[id];
      const b = bar.box();
      bar.put(kept ? { ...b, x: kept.x, y: kept.y } : { ...b, ...at(b) });
      this.settle(bar);
    }
    return bar;
  }

  /** What a slot is called, kept or not. */
  layoutName(slot: number): string {
    return this.layouts[slot]?.name ?? LAYOUT_NAMES[slot] ?? `Layout ${slot + 1}`;
  }

  /** Whether anything has been kept in a slot. */
  layoutKept(slot: number): boolean {
    return Object.keys(this.layouts[slot]?.windows ?? {}).length > 0;
  }

  /** Keep the windows as they are now in a slot, under the name it has, and where the status panel and toolbar are. */
  saveLayout(slot: number): void {
    const windows: Record<string, SavedState> = {};
    for (const [id, w] of this.windows) if (!NOT_LAID_OUT.has(id)) windows[id] = w.state();
    if (this.grid) for (const [id, b] of this.bars) windows[id] = { ...b.box(), open: true };
    this.layouts[slot] = { name: this.layoutName(slot), windows };
    this.putLayouts();
  }

  /** Put every window where a slot has it. False when nothing is kept there. */
  useLayout(slot: number): boolean {
    const l = this.layouts[slot];
    if (!l || !this.layoutKept(slot)) return false;
    for (const [id, w] of this.windows) {
      const st = l.windows[id];
      if (st) w.apply(st);
    }
    for (const [id, b] of this.bars) {
      const st = l.windows[id];
      if (st) b.put({ ...b.box(), x: st.x, y: st.y });
    }
    this.settleAll();
    this.persist();
    return true;
  }

  renameLayout(slot: number, name: string): void {
    const n = name.trim() || LAYOUT_NAMES[slot] || `Layout ${slot + 1}`;
    const l = this.layouts[slot];
    if (l) l.name = n;
    else {
      // A name for a slot nothing is kept in yet is kept anyway, with no windows in it.
      while (this.layouts.length <= slot) this.layouts.push(null);
      this.layouts[slot] = { name: n, windows: {} };
    }
    this.putLayouts();
  }

  private putLayouts(): void {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(this.layouts));
    } catch {
      // Storage unavailable; the arrangement lasts as long as the page.
    }
  }

  /**
   * Pull every window back inside the interface, and on the grid.
   *
   * Called when the interface's own box changes, which is not the same event
   * as the window resizing: a pinch, or a browser deciding to lay the page out
   * nine hundred pixels wide, both move the box while `resize` says nothing.
   * Windows are placed once when they are made, and that happens before the
   * box is first measured, so without this a window keeps the position it was
   * given against a viewport that was never the screen.
   */
  clampAll(): void {
    // Until something is changed here, where the windows were left, laid against the interface's real size.
    if (!this.touched && uiFitted()) for (const [id, win] of this.windows) {
      const st = this.saved[id];
      if (st) win.relay(st);
    }
    // On a phone the windows' floor is the foot of the bars, so the bars are laid first, and the windows at the foot before those kept above them.
    if (!this.grid) this.stackBars();
    const all = [...this.windows.values()];
    for (const w of [...all.filter((w) => w.atFoot), ...all.filter((w) => !w.atFoot)]) w.clamp();
    this.settleAll();
  }

  /** Things laid along the foot of a phone's screen that are not windows: the first-steps card and the spell bar. */
  private static readonly FOOT = '.hud-stack .guide, .spell-bar';
  /** Those already watched for showing, hiding or changing height. */
  private readonly footWatched = new WeakSet<HTMLElement>();

  /**
   * On a phone, how far down a window may reach, in interface pixels. A window
   * at the foot (the event log) may reach the bottom of the screen; any other
   * stops `FOOT_GAP` above the highest of that window, the first-steps card
   * and the spell bar, so it neither lies partly over the log nor goes under
   * the card. Where that leaves less than `MIN_BAND` under the bars (a small
   * phone, a large text size), it lies over the log but stops above the card
   * and the spell bar; and where even that is too little, it reaches the
   * bottom of the screen.
   */
  footFor(win: UIWindow): number {
    const { h } = uiBox();
    if (win.atFoot) return h;
    const floor = uiFloor();
    const logs = [...this.windows.values()].filter((w) => w !== win && w.atFoot && w.placed).map((w) => w.el.offsetTop);
    const rest: number[] = [];
    const k = this.root.offsetWidth ? this.root.getBoundingClientRect().width / this.root.offsetWidth : 1;
    const rootTop = this.root.getBoundingClientRect().top;
    for (const el of this.root.querySelectorAll<HTMLElement>(WindowManager.FOOT)) {
      if (!this.footWatched.has(el)) {
        this.footWatched.add(el);
        new ResizeObserver(() => {
          if (!this.grid) this.clampAll();
        }).observe(el);
      }
      if (el.offsetParent) rest.push((el.getBoundingClientRect().top - rootTop) / k);
    }
    for (const tops of [[...logs, ...rest], rest]) {
      const top = Math.min(h, ...tops) - FOOT_GAP;
      if (top - floor >= MIN_BAND) return top;
    }
    return h;
  }

  /**
   * Off the grid, on a phone: each bar back in its own place (`#ui.narrow` in
   * src/style.css), and moved down clear of any bar above it that has grown
   * over it. The toolbar wraps onto a second row at a large text size, and its
   * frame is taller in Runecut; either way the status panel under it would lie
   * across its foot, name row and all.
   */
  private stackBars(): void {
    const bars = [...this.bars.values()];
    for (const b of bars) b.loose();
    bars.sort((a, b) => a.el.offsetTop - b.el.offsetTop);
    const laid: Box[] = [];
    for (const b of bars) {
      const at = b.box();
      const above = laid.filter((q) => q.x < at.x + at.w && at.x < q.x + q.w && q.y <= at.y);
      const foot = Math.max(at.y, ...above.map((q) => q.y + q.h + BAR_GAP));
      if (foot > at.y) b.el.style.top = `${foot}px`;
      laid.push(b.box());
    }
  }

  /** Told of every window as it is made, after it is placed: Runecut's stone and frame are added here (`src/ui/runecut-dress.ts`). */
  onCreate: ((win: UIWindow) => void) | null = null;

  create(opts: WindowOptions): UIWindow {
    const win = new UIWindow(this, opts, this.saved[opts.id]);
    this.windows.set(opts.id, win);
    this.root.append(win.el);
    win.clamp();
    // Its rim can change under it (Runecut's frames are wider than its stone, and a phone's narrower): whole cells again, and off anything it now covers.
    new ResizeObserver(() => {
      if (!this.grid || this.drag || !win.placed) return;
      const b = win.box(), { w, h } = uiBox();
      if (fits(b.x, b.w, w) && fits(b.y, b.h, h)) return;
      this.settle(win);
      this.rejoin(false);
      if (this.touched) this.persist();
    }).observe(win.el);
    this.bringToFront(win);
    this.onCreate?.(win);
    this.settle(win);
    this.rejoin(false);
    return win;
  }

  get(id: string): UIWindow | undefined {
    return this.windows.get(id);
  }

  toggle(id: string): void {
    this.windows.get(id)?.toggle();
  }

  /** The window last brought to the front, marked `win-front` so Runecut can light its rune. */
  private front: UIWindow | null = null;

  bringToFront(win: UIWindow): void {
    // Counted down again before they reach the seams, keeping the order they are in.
    if (this.z >= Z_TOP) {
      this.z = Z_FLOOR;
      for (const w of [...this.windows.values()].sort((a, b) => Number(a.el.style.zIndex) - Number(b.el.style.zIndex))) w.el.style.zIndex = String(++this.z);
    }
    win.el.style.zIndex = String(++this.z);
    if (this.front === win) return;
    this.front?.el.classList.remove('win-front');
    win.el.classList.add('win-front');
    this.front = win;
    // The seams are drawn over the windows, so they are laid again for the new order: none over a window now in front of them.
    this.rejoin(false);
  }

  persist(): void {
    // Before the interface has its size, a window is only where it was put while it was measured.
    if (!uiFitted()) return;
    this.touched = true;
    const out: Record<string, SavedState> = {};
    for (const [id, w] of this.windows) out[id] = w.state();
    if (this.grid) for (const [id, b] of this.bars) out[id] = { ...b.box(), open: true };
    // What was kept for a window not made yet (the keeper's, made once the island has said so) is kept for when it is.
    this.saved = { ...this.saved, ...out };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.saved));
    } catch {
      // Storage unavailable; layout simply will not persist.
    }
  }
}
