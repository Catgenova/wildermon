import { inkOr } from './inks';
import { drawEmblem } from './emblems';
import { badgeShape } from '../game/badges';

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
  /** A person's trade and class, as class ids, drawn before the name at the writing's height (`src/game/badges.ts`). */
  icons?: string[];
  /** Drawn over the plate once it is placed, at its middle and its top (a speech bubble). */
  over?: (x: number, top: number) => void;
}

/** The name's size in CSS pixels at Text size 100%, at every zoom and on every body. */
export const NAME_PX = 12;
/** A note's size (`NameLabel.note`), the same way. */
const NOTE_PX = 10;
/** An icon before a name, square, as a share of the name's size: the height of its capitals and its tails. */
export const ICON_OF_NAME = 1.15;
/** Between two icons, and between the last and the name, at 100%. */
const ICON_GAP = 2;
const ICON_AFTER = 3;
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
/** Plate pictures kept (`NameLabels.plate`) before all are let go and made afresh. */
const PLATES_MOST = 400;
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

  /** Plate pictures by everything drawn on them and the device pixels a unit (`plate`); let go all at once past `PLATES_MOST`. */
  private plates = new Map<string, HTMLCanvasElement>();

  /** A plate's picture at `dpr` device pixels a unit, made the first time it is asked for as it reads now. */
  private plate(ctx: CanvasRenderingContext2D, lab: NameLabel, dpr: number, w: number, h: number, padY: number, nameH: number, noteH: number,
    icon: number, iconsW: (n: number) => number): HTMLCanvasElement {
    const rim = lab.ink === 'hostile' ? inkOr('bad', '#e2553c', 0.75) : RIM;
    const key = `${dpr}|${w}|${h}|${this.font}|${this.noteFont}|${inkFor(lab.ink)}|${rim}|${lab.icons?.join(',') ?? ''}|${lab.note ?? ''}|${lab.text}`;
    let cv = this.plates.get(key);
    if (cv) return cv;
    if (this.plates.size >= PLATES_MOST) this.plates.clear();
    cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * dpr));
    cv.height = Math.max(1, Math.ceil(h * dpr));
    const g = cv.getContext('2d') as CanvasRenderingContext2D;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawPlate(g, lab, 0, 0, w, h, padY, nameH, noteH, icon, iconsW);
    this.plates.set(key, cv);
    return cv;
  }

  /** A plate and its writing, its top left at (l, t). */
  private drawPlate(ctx: CanvasRenderingContext2D, lab: NameLabel, l: number, t: number, w: number, h: number, padY: number, nameH: number, noteH: number,
    icon: number, iconsW: (n: number) => number): void {
    const s = this.scale;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.beginPath();
    ctx.roundRect(l + 0.5, t + 0.5, w - 1, h - 1, RADIUS * s);
    ctx.lineWidth = 1;
    ctx.fillStyle = PLATE;
    ctx.fill();
    ctx.strokeStyle = lab.ink === 'hostile' ? inkOr('bad', '#e2553c', 0.75) : RIM;
    ctx.stroke();
    const cx = l + w / 2;
    const ink = inkFor(lab.ink);
    if (lab.note) {
      ctx.font = this.noteFont;
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = ink;
      ctx.fillText(lab.note, cx, t + padY + noteH / 2 + 0.5);
      ctx.globalAlpha = 1;
    }
    ctx.font = this.font;
    ctx.fillStyle = ink;
    const mid = t + h - padY - nameH / 2;
    // The icons first, the name after them: the two together centred on the plate.
    const n = lab.icons?.length ?? 0;
    if (n) {
      const lead = iconsW(n);
      let x = cx - (lead + this.width(ctx, this.font, lab.text)) / 2;
      for (const id of lab.icons!) {
        drawEmblem(ctx, id, badgeShape(id), x, mid - icon / 2, icon);
        x += icon + ICON_GAP * s;
      }
      ctx.fillText(lab.text, cx + lead / 2, mid + 0.5);
    } else {
      ctx.fillText(lab.text, cx, mid + 0.5);
    }
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
    const icon = Math.round(NAME_PX * s * ICON_OF_NAME);
    const iconsW = (n: number): number => (n ? n * icon + (n - 1) * ICON_GAP * s + ICON_AFTER * s : 0);
    for (const lab of list) {
      const tw = this.width(ctx, this.font, lab.text) + iconsW(lab.icons?.length ?? 0);
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
    // Then the plates and their writing: each from a picture of it (`plate`), made once while it reads the same.
    const m = ctx.getTransform();
    const square = m.b === 0 && m.c === 0 && m.a === m.d && m.a > 0;
    for (let i = 0; i < list.length; i++) {
      const p = at[i];
      const lab = list[i];
      if (!square) {
        this.drawPlate(ctx, lab, p.l, p.t, p.w, p.h, padY, nameH, noteH, icon, iconsW);
        continue;
      }
      // Put down a device pixel to a device pixel, on whole ones: stretched or on a fraction of one, at a screen scale of
      // 1.25 or 1.5 (or a Render scale under 100%), the writing came out blurred.
      const cv = this.plate(ctx, lab, m.a, p.w, p.h, padY, nameH, noteH, icon, iconsW);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(cv, Math.round(p.l * m.a + m.e), Math.round(p.t * m.a + m.f));
      ctx.setTransform(m);
    }
    ctx.restore();
    for (let i = 0; i < list.length; i++) list[i].over?.(at[i].l + at[i].w / 2, at[i].t);
    list.length = 0;
    this.blocks.length = 0;
  }
}
