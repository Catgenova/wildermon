import { inkOr } from './inks';

/**
 * The names over creatures and people, drawn in one layer over the frame.
 *
 * Each body hands in its name, whose it is and where its head is while it is
 * drawn (`add`); once every body is down, `flush` lays them all out at once and
 * draws them. A name is the same size at every zoom and on every body
 * (`NAME_PX`, times Settings, Text size), on a plate of its own. Laid out
 * nearest first (the lowest feet on the screen): a plate that would cover one
 * already placed is moved up a plate at a time, or a little to either side,
 * until it is clear, and one moved off its head has a line back down to it.
 * None is left out: there is always room higher up.
 */

/** Whose name it is, which is its colour: a person, your own wildermon, somebody else's, a wild one, or one hostile to you. */
export type NameInk = 'player' | 'mine' | 'theirs' | 'wild' | 'hostile';

export interface NameLabel {
  text: string;
  /** A second, smaller line over the name: what a person is at. */
  note?: string;
  ink: NameInk;
  /** The body's x on the screen. */
  x: number;
  /** The top of the body on the screen: where the line from a moved plate goes. */
  head: number;
  /** How far over `head` the plate starts, in screen pixels, for what else is drawn there (a health bar, a threat marker). */
  lift?: number;
  /** The body's feet on the screen: the lower, the nearer, and the first placed. */
  z: number;
  /** Drawn over the plate once it is placed, at its middle and its top (a speech bubble). */
  over?: (x: number, top: number) => void;
}

/** The name's size in CSS pixels at Text size 100%, at every zoom and on every body. */
export const NAME_PX = 12;
/** A note's size (`NameLabel.note`), the same way. */
const NOTE_PX = 10;
/** The plate's padding round the writing, across and up and down, and its corners' radius, at 100%. */
const PAD_X = 5;
const PAD_Y = 2;
const RADIUS = 4;
/** Between the top of what is over the head and the bottom of the plate, at 100%. */
const GAP = 3;
/** Between two plates moved clear of each other. */
const APART = 2;
/** How far a plate may be moved before it gets a line back to its head. */
const LEADER_FROM = 5;
/** How many plate heights up it is looked for room; past that it is put at the last, which a screen never reaches. */
const MAX_STEPS = 400;

const PLATE = 'rgba(18, 16, 14, 0.74)';
const RIM = 'rgba(255, 255, 255, 0.16)';
/** A moved plate's line to its head: dark, in a pale edge, so it shows on snow and on grass at night alike. */
const LEADER = 'rgba(18, 16, 14, 0.75)';
const LEADER_EDGE = 'rgba(255, 255, 255, 0.3)';

/** Writing on the plate, by whose: white for a person, gold for yours, beige for somebody else's, grey for a wild one, red for a hostile one. */
function inkFor(ink: NameInk): string {
  switch (ink) {
    case 'player': return '#f4f6fa';
    case 'mine': return '#f5cf6a';
    case 'theirs': return '#d9c29b';
    case 'wild': return '#b8c3c8';
    case 'hostile': return inkOr('bad', '#ff7a63');
  }
}

interface Placed {
  l: number;
  t: number;
  w: number;
  h: number;
}

export class NameLabels {
  private list: NameLabel[] = [];
  /** Rectangles no plate may cover (a threat marker), as left, top, width, height. */
  private blocks: Placed[] = [];
  private scale = 1;
  private font = '';
  private noteFont = '';
  private widths = new Map<string, number>();
  /** The plates placed so far this flush, by the band of the screen they are in, for looking up what one would cover. */
  private grid = new Map<number, Placed[]>();

  /** A new frame: nothing to draw yet, at Text size `scale`. */
  begin(scale: number): void {
    this.list.length = 0;
    this.blocks.length = 0;
    this.scale = scale > 0 && Number.isFinite(scale) ? scale : 1;
    // The interface's own face (src/style.css `--ui-font`): Alegreya Sans in Runecut, Segoe UI in Classic.
    const classic = typeof document !== 'undefined' && document.documentElement.dataset.ui === 'classic';
    const family = classic ? `'Segoe UI', system-ui, sans-serif` : `'Alegreya Sans', 'Segoe UI', system-ui, sans-serif`;
    const font = `500 ${NAME_PX * this.scale}px ${family}`;
    if (font !== this.font) this.widths.clear();
    this.font = font;
    this.noteFont = `500 ${NOTE_PX * this.scale}px ${family}`;
  }

  /** Drop what has been handed in, for a pass drawn over it (the cellar over the country). */
  clear(): void {
    this.list.length = 0;
    this.blocks.length = 0;
  }

  add(label: NameLabel): void {
    if (label.text) this.list.push(label);
  }

  /** Keep every plate off this rectangle. */
  block(left: number, top: number, w: number, h: number): void {
    this.blocks.push({ l: left, t: top, w, h });
  }

  private width(ctx: CanvasRenderingContext2D, font: string, text: string): number {
    const key = font === this.font ? text : `\u0001${text}`;
    let w = this.widths.get(key);
    if (w === undefined) {
      ctx.font = font;
      w = ctx.measureText(text).width;
      if (this.widths.size > 4000) this.widths.clear();
      this.widths.set(key, w);
    }
    return w;
  }

  private static readonly BAND = 48;

  private put(p: Placed): void {
    const B = NameLabels.BAND;
    for (let b = Math.floor(p.t / B), e = Math.floor((p.t + p.h) / B); b <= e; b++) {
      let row = this.grid.get(b);
      if (!row) this.grid.set(b, (row = []));
      row.push(p);
    }
  }

  private covers(l: number, t: number, w: number, h: number): boolean {
    const B = NameLabels.BAND;
    for (let b = Math.floor(t / B), e = Math.floor((t + h) / B); b <= e; b++) {
      const row = this.grid.get(b);
      if (!row) continue;
      for (const p of row) {
        if (l < p.l + p.w + APART && p.l < l + w + APART && t < p.t + p.h + APART && p.t < t + h + APART) return true;
      }
    }
    return false;
  }

  /** Lay out every name handed in this frame and draw them, over everything already on `ctx`. */
  flush(ctx: CanvasRenderingContext2D): void {
    const list = this.list;
    if (!list.length) {
      this.blocks.length = 0;
      return;
    }
    const s = this.scale;
    const padX = PAD_X * s, padY = PAD_Y * s, nameH = Math.round(NAME_PX * s * 1.25), noteH = Math.round(NOTE_PX * s * 1.2);
    this.grid.clear();
    for (const b of this.blocks) this.put(b);
    // Nearest first, so the one in front keeps the place over its own head.
    list.sort((a, b) => b.z - a.z);
    const at: Array<{ l: number; t: number; w: number; h: number; moved: boolean }> = [];
    for (const lab of list) {
      const tw = this.width(ctx, this.font, lab.text);
      const nw = lab.note ? this.width(ctx, this.noteFont, lab.note) : 0;
      const w = Math.ceil(Math.max(tw, nw) + 2 * padX);
      const h = nameH + (lab.note ? noteH : 0) + 2 * padY;
      const l0 = Math.round(lab.x - w / 2);
      const t0 = Math.round(lab.head - (lab.lift ?? 0) - GAP * s - h);
      const nudge = Math.round(Math.min(w * 0.4, 28 * s));
      let l = l0, t = t0, found = false;
      for (let k = 0; k < MAX_STEPS && !found; k++) {
        const tk = t0 - k * (h + APART);
        for (const dx of k === 0 ? [0, -nudge, nudge] : [0, -nudge, nudge, -2 * nudge, 2 * nudge]) {
          if (!this.covers(l0 + dx, tk, w, h)) {
            l = l0 + dx;
            t = tk;
            found = true;
            break;
          }
        }
        if (!found) t = tk;
      }
      const p = { l, t, w, h, moved: Math.abs(l - l0) + Math.abs(t - t0) > LEADER_FROM };
      this.put(p);
      at.push(p);
    }
    ctx.save();
    // Lines first, so every plate is over every line: each from the plate's foot to a dot on the head.
    const lines = new Path2D(), dots = new Path2D();
    let any = false;
    for (let i = 0; i < list.length; i++) {
      const p = at[i];
      if (!p.moved) continue;
      const lab = list[i];
      const fx = Math.max(p.l + RADIUS, Math.min(p.l + p.w - RADIUS, lab.x));
      lines.moveTo(fx + 0.5, p.t + p.h);
      lines.lineTo(lab.x + 0.5, lab.head);
      dots.moveTo(lab.x + 2, lab.head);
      dots.arc(lab.x + 0.5, lab.head, 1.5, 0, Math.PI * 2);
      any = true;
    }
    if (any) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = LEADER_EDGE;
      ctx.stroke(lines);
      ctx.lineWidth = 1;
      ctx.strokeStyle = LEADER;
      ctx.stroke(lines);
      ctx.fillStyle = LEADER;
      ctx.fill(dots);
    }
    // Then the plates and their writing.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < list.length; i++) {
      const p = at[i];
      const lab = list[i];
      ctx.beginPath();
      ctx.roundRect(p.l + 0.5, p.t + 0.5, p.w - 1, p.h - 1, RADIUS * s);
      ctx.fillStyle = PLATE;
      ctx.fill();
      ctx.strokeStyle = lab.ink === 'hostile' ? inkOr('bad', '#e2553c', 0.75) : RIM;
      ctx.stroke();
      const cx = p.l + p.w / 2;
      const ink = inkFor(lab.ink);
      if (lab.note) {
        ctx.font = this.noteFont;
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = ink;
        ctx.fillText(lab.note, cx, p.t + padY + noteH / 2 + 0.5);
        ctx.globalAlpha = 1;
      }
      ctx.font = this.font;
      ctx.fillStyle = ink;
      ctx.fillText(lab.text, cx, p.t + p.h - padY - nameH / 2 + 0.5);
    }
    ctx.restore();
    for (let i = 0; i < list.length; i++) list[i].over?.(at[i].l + at[i].w / 2, at[i].t);
    list.length = 0;
    this.blocks.length = 0;
  }
}
