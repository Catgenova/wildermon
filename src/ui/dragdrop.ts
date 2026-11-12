/**
 * Dragging things from one window to another, by pointer events of our own
 * rather than the browser's drag and drop.
 *
 * Reported: "when clicking and dragging inventory to move to another
 * container, the whole game stutters down to 1fps". The browser's own drag
 * (`draggable`, `dragstart`, `dragover`) hands the pointer to the operating
 * system's drag loop for as long as the button is down, and while that loop
 * runs the page is drawn a few times a second whatever it asks for: the
 * handlers here measured 0.07 ms a move, and the frames fell anyway. A press
 * on a row that travels `DRAG_START` px picks the thing up instead; the row
 * captures the pointer, a ghost of the name follows the cursor, what is under
 * it is asked (`elementFromPoint`) for the nearest drop zone, and letting go
 * drops it there. The frame loop never stops.
 */
export interface DragPayload {
  /** The item being dragged. */
  uid: number;
  /** Which side it came from. */
  from: 'inventory' | 'store';
  /** What it is called, for the ghost and for the message when it will not go. */
  name: string;
  /**
   * Shift was held as the drag began: ask how many of the stack to move rather
   * than moving the lot.
   */
  split?: boolean;
  /** Every thing picked (`Picking`), when the row dragged is one of several picked: they all go, each whole. */
  uids?: number[];
}

/** How far a press travels before it is a drag and not a click, in px. */
export const DRAG_START = 5;

interface Zone {
  el: HTMLElement;
  accept: (p: DragPayload, x: number, y: number) => boolean;
  drop: (p: DragPayload, x: number, y: number) => void;
  leave?: () => void;
}

let carried: DragPayload | null = null;
const zones = new Map<HTMLElement, Zone>();
/** The zone under the pointer that will take what is carried, highlighted. */
let over: Zone | null = null;
let ghost: HTMLElement | null = null;
/** The row a drag began on, dimmed while it lasts. */
let source: HTMLElement | null = null;
/** A drag just ended on this pointer: the click the browser makes of its release is not a click on the row. */
let justDropped = false;

export const dragging = (): DragPayload | null => carried;

/** The zone nearest under a point whose `accept` takes what is carried, the ghost looked past. */
function zoneAt(p: DragPayload, x: number, y: number): Zone | null {
  let el = document.elementFromPoint(x, y);
  while (el) {
    const z = zones.get(el as HTMLElement);
    if (z && z.accept(p, x, y)) return z;
    el = el.parentElement;
  }
  return null;
}

function leaveZone(): void {
  if (!over) return;
  over.el.classList.remove('drop-target');
  over.leave?.();
  over = null;
}

function moveTo(x: number, y: number): void {
  const p = carried;
  if (!p) return;
  if (ghost) {
    ghost.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y + 10)}px)`;
  }
  const z = zoneAt(p, x, y);
  if (z !== over) {
    leaveZone();
    over = z;
    if (z) z.el.classList.add('drop-target');
  }
  document.body.classList.toggle('drag-no', !z);
}

/** The drag under way: its pointer, and the row it began on. */
let active: { id: number; row: HTMLElement } | null = null;

function end(dropAt: { x: number; y: number } | null): void {
  const p = carried;
  if (!p) return;
  const z = dropAt ? zoneAt(p, dropAt.x, dropAt.y) : null;
  carried = null;
  leaveZone();
  ghost?.remove();
  ghost = null;
  source?.classList.remove('drag-source');
  source = null;
  if (active) {
    try { active.row.releasePointerCapture(active.id); } catch { /* released already */ }
    active = null;
  }
  window.removeEventListener('pointermove', onMove, true);
  window.removeEventListener('pointerup', onUp, true);
  window.removeEventListener('pointercancel', onCancel, true);
  document.body.classList.remove('dragging', 'drag-no');
  if (z && dropAt) z.drop(p, dropAt.x, dropAt.y);
}

/*
 * While something is carried the pointer is heard here, on the window ahead
 * of everything else, and goes no further: the canvas under a drop never
 * takes the release as a click on the ground, and a row the pack redraws
 * from under the drag (the island sends the pack again while the button is
 * down) loses nothing, since the drag never depended on it.
 */
function onMove(e: PointerEvent): void {
  if (!active || e.pointerId !== active.id) return;
  e.stopPropagation();
  // The button came up off the page, where no release was heard.
  if (e.pointerType === 'mouse' && e.buttons === 0) { end(null); return; }
  moveTo(e.clientX, e.clientY);
}
function onUp(e: PointerEvent): void {
  if (!active || e.pointerId !== active.id) return;
  e.stopPropagation();
  e.preventDefault();
  justDropped = true;
  window.setTimeout(() => (justDropped = false), 0);
  end({ x: e.clientX, y: e.clientY });
}
function onCancel(e: PointerEvent): void {
  if (!active || e.pointerId !== active.id) return;
  e.stopPropagation();
  end(null);
}

function begin(row: HTMLElement, p: DragPayload, id: number, x: number, y: number): void {
  carried = p;
  active = { id, row };
  source = row;
  row.classList.add('drag-source');
  try { row.setPointerCapture(id); } catch { /* gone from the page between press and move */ }
  ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = p.uids && p.uids.length > 1 ? `${p.name} +${p.uids.length - 1}` : p.name;
  document.body.append(ghost);
  document.body.classList.add('dragging');
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
  moveTo(x, y);
}

// Heard from the page's first script on; the rules' tests run these modules under Node, where there is no window.
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && carried) end(null);
  });
  window.addEventListener('blur', () => end(null));
  // The release that ends a drag is no click on the row it began on or the thing it was let go over.
  window.addEventListener('click', (e) => {
    if (!justDropped) return;
    justDropped = false;
    e.stopPropagation();
    e.preventDefault();
  }, { capture: true });
}

/**
 * A press on a row that may become a drag: kept here rather than on the row,
 * since the pack is drawn again whenever the island sends it and the row
 * pressed may be gone by the time the pointer has travelled.
 */
let press: { id: number; x: number; y: number; shift: boolean; row: HTMLElement; payload: DragPayload | null | (() => DragPayload | null) } | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e) => {
    if (!press || carried || e.pointerId !== press.id) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { press = null; return; }
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_START) return;
    const { row, payload, shift } = press;
    press = null;
    const p = typeof payload === 'function' ? payload() : payload;
    if (!p || p.uid < 0) return;
    // A part of a stack is asked for only when one stack is carried.
    begin(row, { ...p, split: shift && !(p.uids && p.uids.length > 1) }, e.pointerId, e.clientX, e.clientY);
  }, true);
  for (const t of ['pointerup', 'pointercancel'] as const) window.addEventListener(t, (e) => { if (press && e.pointerId === press.id) press = null; }, true);
}

/** Make a row something that can be picked up and carried to another window. A payload of null is nothing to carry. */
export function makeDraggable(row: HTMLElement, payload: DragPayload | null | (() => DragPayload | null)): void {
  row.draggable = false;
  row.addEventListener('dragstart', (e) => e.preventDefault());
  row.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch' || carried) return;
    if (e.target instanceof Element && e.target.closest('input, button, select, textarea, a')) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, shift: e.shiftKey, row, payload };
  });
  // No text selected along the way.
  row.addEventListener('selectstart', (e) => { if (press || carried) e.preventDefault(); });
}

/**
 * Make an area somewhere a dragged thing can be let go of. `accept` says
 * whether this drop would work at all, which decides the cursor and the
 * highlight, asked on every move with the pointer's place; `drop` does it;
 * `leave` hears when the pointer has gone off it or the drag ended elsewhere.
 */
export function makeDropZone(el: HTMLElement, accept: (p: DragPayload, x: number, y: number) => boolean, drop: (p: DragPayload, x: number, y: number) => void, leave?: () => void): void {
  zones.set(el, { el, accept, drop, leave });
}
