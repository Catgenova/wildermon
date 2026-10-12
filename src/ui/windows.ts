import { uiBox, uiFloor, uiPoint } from './screen';
import { LAYOUT_NAMES } from '../game/keybinds';
import { runeFor, runeSvg } from './theme';

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

/** How close, in interface pixels, an edge has to come to another before a drag puts it against it. */
export const SNAP = 10;
/** The arrangements of windows kept, each called back with a key of its own (`layout_1`…). */
export const LAYOUT_SLOTS = LAYOUT_NAMES.length;
/** Windows that are never part of an arrangement, because they are opened by something happening rather than by you. */
const NOT_LAID_OUT = new Set(['away', 'news', 'hoard']);

/** A draggable, resizable overlay window in the Wurm style. */
export class UIWindow {
  readonly el: HTMLDivElement;
  readonly body: HTMLDivElement;
  readonly titleText: HTMLSpanElement;
  private readonly expandBtn: HTMLButtonElement;
  private readonly seeBtn: HTMLButtonElement | null = null;
  private maximized = false;
  private see = false;
  /** Geometry to go back to when the window is restored from expanded. */
  private normal: Geometry | null = null;

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
    this.expandBtn.textContent = EXPAND_ICON;
    this.expandBtn.addEventListener('click', () => this.toggleMaximized());
    const close = document.createElement('button');
    close.className = 'win-btn win-close';
    close.type = 'button';
    close.title = 'Close';
    close.textContent = '×';
    close.addEventListener('click', () => this.close());
    if (opts.seeThrough) {
      const see = document.createElement('button');
      see.className = 'win-btn win-see-btn';
      see.type = 'button';
      see.textContent = SEE_ICON;
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
    this.el.append(title, this.body);

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
    if (saved?.max) this.setMaximized(true, false);
    this.setSeeThrough(!!(opts.seeThrough && saved?.see), false);

    let drag: { dx: number; dy: number } | null = null;
    title.addEventListener('pointerdown', (e) => {
      if (buttons.contains(e.target as Node) || e.button !== 0 || this.maximized) return;
      const at = uiPoint(e);
      drag = { dx: at.x - this.el.offsetLeft, dy: at.y - this.el.offsetTop };
      title.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    title.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const at = uiPoint(e);
      this.el.style.left = `${at.x - drag.dx}px`;
      this.el.style.top = `${at.y - drag.dy}px`;
      // Alt held lets a window go exactly where it is put.
      if (!e.altKey) this.snap();
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
      this.seeBtn.title = on
        ? 'Solid again. While it is see-through, hold Alt to click in it.'
        : 'See-through: dimmed, and clicks on it go to the island. Hold Alt to click in it.';
    }
    if (persist) this.mgr.persist();
  }

  /**
   * Put the window's edges against the edges near them: the sides of the
   * interface, and the sides of every other open window, either butted up to
   * one or lined up with it. Each axis takes its nearest edge within `SNAP`,
   * or stays where the drag left it.
   */
  private snap(): void {
    const box = uiBox();
    const floor = uiFloor();
    const me = { x: this.el.offsetLeft, y: this.el.offsetTop, w: this.el.offsetWidth, h: this.el.offsetHeight };
    const xs = [0, box.w - me.w];
    const ys = [floor, box.h - me.h];
    for (const o of this.mgr.windows.values()) {
      if (o === this || !o.isOpen || o.isMaximized) continue;
      const r = { x: o.el.offsetLeft, y: o.el.offsetTop, w: o.el.offsetWidth, h: o.el.offsetHeight };
      // Only windows level with this one, give or take, offer their sides; and only ones above or below it their tops and bottoms.
      const level = me.y < r.y + r.h + SNAP && me.y + me.h > r.y - SNAP;
      const stacked = me.x < r.x + r.w + SNAP && me.x + me.w > r.x - SNAP;
      if (level || stacked) xs.push(r.x - me.w, r.x + r.w, r.x, r.x + r.w - me.w);
      if (stacked || level) ys.push(r.y - me.h, r.y + r.h, r.y, r.y + r.h - me.h);
    }
    const nearest = (at: number, to: number[]): number => {
      let best = at;
      let gap = SNAP + 1;
      for (const c of to) {
        const d = Math.abs(c - at);
        if (d < gap) {
          gap = d;
          best = c;
        }
      }
      return best;
    };
    this.el.style.left = `${nearest(me.x, xs)}px`;
    this.el.style.top = `${nearest(me.y, ys)}px`;
  }

  /** Put the window where a saved arrangement has it: its place, its size, open or shut, expanded or not. */
  apply(st: SavedState): void {
    if (this.maximized) this.setMaximized(false, false);
    this.applyGeometry(st);
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
      this.mgr.bringToFront(this);
    } else {
      this.el.classList.remove('maximized');
      if (this.normal) this.applyGeometry(this.normal);
      this.expandBtn.textContent = EXPAND_ICON;
      this.expandBtn.title = 'Expand';
      this.clamp();
    }
    if (persist) this.mgr.persist();
  }

  private applyMaximized(): void {
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
    this.clamp();
    this.onOpen?.();
    this.mgr.persist();
  }

  close(): void {
    this.el.hidden = true;
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
    const room = Math.max(70, box.h - floor - 12);
    const [fw, fh] = this.frame();
    if (this.el.offsetHeight > room) this.el.style.height = `${room - fh}px`;
    const wide = Math.max(160, box.w - 12);
    if (this.el.offsetWidth > wide) this.el.style.width = `${wide - fw}px`;

    const maxLeft = Math.max(0, box.w - this.el.offsetWidth);
    const maxTop = Math.max(floor, box.h - this.el.offsetHeight);
    this.el.style.left = `${Math.min(maxLeft, Math.max(0, this.el.offsetLeft))}px`;
    this.el.style.top = `${Math.min(maxTop, Math.max(floor, this.el.offsetTop))}px`;
  }

  state(): SavedState {
    const g = this.maximized && this.normal ? this.normal : this.geometry();
    return { ...g, open: this.isOpen, max: this.maximized, ...(this.opts.seeThrough ? { see: this.see } : {}) };
  }
}

export class WindowManager {
  readonly windows = new Map<string, UIWindow>();
  private z = 100;
  private saved: Record<string, SavedState> = {};
  /** The kept arrangements, one a slot, null where nothing has been kept yet. */
  private layouts: Array<Layout | null> = [];

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
    window.addEventListener('resize', () => this.clampAll());
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

  /** What a slot is called, kept or not. */
  layoutName(slot: number): string {
    return this.layouts[slot]?.name ?? LAYOUT_NAMES[slot] ?? `Layout ${slot + 1}`;
  }

  /** Whether anything has been kept in a slot. */
  layoutKept(slot: number): boolean {
    return Object.keys(this.layouts[slot]?.windows ?? {}).length > 0;
  }

  /** Keep the windows as they are now in a slot, under the name it has. */
  saveLayout(slot: number): void {
    const windows: Record<string, SavedState> = {};
    for (const [id, w] of this.windows) if (!NOT_LAID_OUT.has(id)) windows[id] = w.state();
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
   * Pull every window back inside the interface.
   *
   * Called when the interface's own box changes, which is not the same event
   * as the window resizing: a pinch, or a browser deciding to lay the page out
   * nine hundred pixels wide, both move the box while `resize` says nothing.
   * Windows are placed once when they are made, and that happens before the
   * box is first measured, so without this a window keeps the position it was
   * given against a viewport that was never the screen.
   */
  clampAll(): void {
    for (const w of this.windows.values()) w.clamp();
  }

  /** Told of every window as it is made, after it is placed: Runecut's stone and frame are added here (`src/ui/runecut-dress.ts`). */
  onCreate: ((win: UIWindow) => void) | null = null;

  create(opts: WindowOptions): UIWindow {
    const win = new UIWindow(this, opts, this.saved[opts.id]);
    this.windows.set(opts.id, win);
    this.root.append(win.el);
    win.clamp();
    this.bringToFront(win);
    this.onCreate?.(win);
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
    win.el.style.zIndex = String(++this.z);
    if (this.front === win) return;
    this.front?.el.classList.remove('win-front');
    win.el.classList.add('win-front');
    this.front = win;
  }

  persist(): void {
    const out: Record<string, SavedState> = {};
    for (const [id, w] of this.windows) out[id] = w.state();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
      // Storage unavailable; layout simply will not persist.
    }
  }
}
