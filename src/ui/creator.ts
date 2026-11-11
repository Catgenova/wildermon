import {
  GENDERS, HAIRSTYLES, HAIR_RAMP, HAIR_WHITE, SKIN_RAMP, cleanLook, hairColour, randomLook, skinColour, toneOf,
  type Look, type Ramp,
} from '../game/look';
import { sculptedFigures, sculptedReady, type FigurePose } from '../render/figure';
import { drawPortrait } from '../render/sprites';

/** Dragging across the mirror turns it an eighth for every so far dragged. */
const DRAG_STEP = 26;
/** A slider's steps from one end to the other: a look keeps its numbers to three places. */
const STEPS = 1000;
type Outfit = NonNullable<FigurePose['outfit']>;
/** Every piece of the first outfit off: the body in its painted undergarment. */
const BARE: Outfit = { shawl: false, trousers: false, boots: false, tunic: false, hood: false };
/**
 * What the preview can show the body in, by the game's own outfit flags (`FigurePose.outfit`, as the review tools in
 * `tools/sculpt/*game.mjs` set them): the undergarment alone (the first, what the preview opens on), and each set of
 * clothes and armour whole. Another set is another row.
 */
const OUTFITS: ReadonlyArray<{ id: string; name: string; outfit: Outfit }> = [
  { id: 'none', name: 'None', outfit: BARE },
  { id: 'cloth', name: 'Cloth', outfit: { shawl: true, trousers: true, boots: true, tunic: true, hood: false } },
  { id: 'leather', name: 'Leather', outfit: { ...BARE, leatherChest: true, leatherLegs: true, leatherBoots: true, leatherShawl: true, leatherHat: true } },
  { id: 'plate', name: 'Plate', outfit: { ...BARE, plateHelm: true, plateMantle: true, plateChest: true, plateLegs: true, plateBoots: true } },
];

const button = (className: string, text: string, label?: string): HTMLButtonElement => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = text;
  if (label) {
    b.setAttribute('aria-label', label);
    b.title = label;
  }
  return b;
};

/** A ramp as a CSS gradient left to right: straight between the stops in sRGB, as `rampColour` mixes them, so the track is the colours. */
const gradientOf = (r: Ramp): string => `linear-gradient(to right, ${r.colour.map((c, i) => `${c} ${(r.at[i] * 100).toFixed(1)}%`).join(', ')})`;

interface Slider {
  input: HTMLInputElement;
  swatch: HTMLElement;
  /** The colour the look comes to, for the swatch; and the track's background, for the look. */
  colour: (l: Look) => string;
  track: (l: Look) => string;
  key: 'skin' | 'hairColour' | 'hairGrey';
}

/**
 * The character creator: a mirror, and the choices a look has.
 *
 * The account page shows it to a new account before it comes ashore, and to
 * anybody sent back to it from the game's Settings to change their look. It is
 * the one creator either way, so a second visit offers exactly what the first
 * did.
 *
 * The mirror is the sculpted body the island draws (`drawPortrait`, with the
 * Sculpted figures path turned on for this page): the man's or the woman's,
 * standing in its idle, in its painted undergarment or one of the sets of
 * clothes and armour (`OUTFITS`), turned by its arrows, by dragging or by the arrow
 * keys. Under it, a button per body and a thumbnail per hairstyle there is a
 * mesh for (`HAIRSTYLES`), and sliders for the skin, the hair's colour and its
 * grey, each with the exact colour beside it. Every change is in the mirror on
 * its next frame.
 *
 * It keeps the look being chosen and nothing else. Keeping it anywhere is the
 * page's business, off a button of its own. Its rules are in `creator.css`.
 */
export class Creator {
  readonly el: HTMLDivElement;
  private chosen: Look;
  /** A body or hairstyle the pointer rests on or the keyboard is on, shown in the mirror until it moves off. */
  private preview: Look | null = null;
  private readonly mirror: HTMLCanvasElement;
  private readonly choices: HTMLDivElement;
  private readonly closeUp: HTMLButtonElement;
  private readonly dressed: HTMLButtonElement[] = [];
  private readonly thumbs: Array<{ canvas: HTMLCanvasElement; hair: string }> = [];
  private readonly marks: Array<{ kind: 'gender' | 'hair'; id: string; button: HTMLButtonElement; label: HTMLElement; name: string }> = [];
  private readonly sliders: Slider[] = [];
  private walking = 0;
  private facing = 1;
  private close = false;
  private outfit: Outfit = OUTFITS[0].outfit;
  /** Whether the thumbnails were last drawn with the sculpted bodies loaded: they land after the page does. */
  private thumbsSculpted = false;

  /** `shown` says whether anybody can see it; the mirror stops moving while nobody can. */
  constructor(start: Look, private readonly shown: () => boolean) {
    // The sculpted bodies, the island's own: the flat figure only until they have loaded, or with no WebGL2.
    sculptedFigures(true, 'creator');
    this.chosen = cleanLook(start);
    this.el = document.createElement('div');
    this.el.className = 'cr';
    const inner = document.createElement('div');
    inner.className = 'cr-in';
    const column = document.createElement('div');
    column.className = 'cr-mirror';

    this.mirror = document.createElement('canvas');
    this.mirror.className = 'cr-me';
    this.mirror.width = 240;
    this.mirror.height = 380;
    this.mirror.tabIndex = 0;
    this.mirror.setAttribute('aria-label', 'Preview. Drag or arrow keys to turn.');

    const turn = document.createElement('div');
    turn.className = 'cr-turn';
    const left = button('', '◀', 'Turn left');
    this.closeUp = button('cr-close', 'Head', 'Zoom to head');
    this.closeUp.setAttribute('aria-pressed', 'false');
    const right = button('', '▶', 'Turn right');
    left.addEventListener('click', () => this.turn(-1));
    right.addEventListener('click', () => this.turn(1));
    this.closeUp.addEventListener('click', () => {
      this.close = !this.close;
      this.closeUp.setAttribute('aria-pressed', String(this.close));
    });
    turn.append(left, this.closeUp, right);

    // What the preview shows the body in: one of OUTFITS.
    const wear = document.createElement('div');
    wear.className = 'cr-turn cr-wear';
    wear.setAttribute('role', 'group');
    wear.setAttribute('aria-label', 'Outfit');
    for (const o of OUTFITS) {
      const b = button('', o.name);
      b.dataset.outfit = o.id;
      b.setAttribute('aria-pressed', String(o.outfit === this.outfit));
      b.addEventListener('click', () => {
        this.outfit = o.outfit;
        for (const d of this.dressed) d.setAttribute('aria-pressed', String(d === b));
      });
      this.dressed.push(b);
      wear.append(b);
    }

    const roll = button('cr-roll', 'Random');
    roll.addEventListener('click', () => {
      this.look = randomLook();
    });

    column.append(this.mirror, turn, wear, roll);

    this.choices = document.createElement('div');
    this.choices.className = 'cr-choices';
    inner.append(column, this.choices);
    this.el.append(inner);

    let dragFrom: number | null = null;
    this.mirror.addEventListener('pointerdown', (e) => {
      dragFrom = e.clientX;
      this.mirror.setPointerCapture(e.pointerId);
    });
    this.mirror.addEventListener('pointermove', (e) => {
      if (dragFrom === null) return;
      const steps = Math.trunc((e.clientX - dragFrom) / DRAG_STEP);
      if (steps) {
        this.turn(steps);
        dragFrom += steps * DRAG_STEP;
      }
    });
    const letGo = (): void => { dragFrom = null; };
    this.mirror.addEventListener('pointerup', letGo);
    this.mirror.addEventListener('pointercancel', letGo);
    this.mirror.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this.turn(e.key === 'ArrowLeft' ? -1 : 1);
        e.preventDefault();
        // In the game the arrows also push the view about; turning the mirror is all this press was for.
        e.stopPropagation();
      }
    });

    this.buildChoices();
    this.redraw();
  }

  /** The look being chosen. */
  get look(): Look {
    return this.chosen;
  }

  set look(l: Look) {
    this.chosen = cleanLook(l);
    this.preview = null;
    this.redraw();
  }

  /** Start the mirror moving, if it is not already. It stops by itself once it cannot be seen. */
  wake(): void {
    if (!this.walking) this.walking = requestAnimationFrame((now) => this.frame(now));
  }

  /** A heading with the chosen thing's name beside it, and the row under it. */
  private block(title: string): { row: HTMLDivElement; label: HTMLSpanElement } {
    const block = document.createElement('div');
    block.className = 'cr-choice';
    const head = document.createElement('h2');
    head.textContent = title;
    const label = document.createElement('span');
    head.append(label);
    const row = document.createElement('div');
    row.className = 'cr-row';
    block.append(head, row);
    this.choices.append(block);
    return { row, label };
  }

  /** A choice of id: put on when clicked, tried on in the mirror while the pointer or the keyboard rests on it. */
  private pick(b: HTMLButtonElement, kind: 'gender' | 'hair', id: string, name: string, label: HTMLElement): void {
    b.dataset.kind = kind;
    b.dataset.id = id;
    b.addEventListener('click', () => {
      this.look = { ...this.chosen, [kind]: id };
    });
    const tryOn = (): void => { this.preview = cleanLook({ ...this.chosen, [kind]: id }); };
    const takeOff = (): void => { this.preview = null; };
    b.addEventListener('pointerenter', tryOn);
    b.addEventListener('focus', tryOn);
    b.addEventListener('pointerleave', takeOff);
    b.addEventListener('blur', takeOff);
    this.marks.push({ kind, id, button: b, label, name });
  }

  private slider(title: string, key: Slider['key'], colour: Slider['colour'], track: Slider['track']): void {
    const { row } = this.block(title);
    row.classList.add('cr-tone');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(STEPS);
    input.step = '1';
    input.className = 'cr-slide';
    input.dataset.kind = key;
    input.setAttribute('aria-label', title);
    const swatch = document.createElement('span');
    swatch.className = 'cr-dab';
    swatch.dataset.kind = key;
    swatch.setAttribute('aria-hidden', 'true');
    input.addEventListener('input', () => {
      this.look = { ...this.chosen, [key]: toneOf(Number(input.value) / STEPS) };
    });
    row.append(input, swatch);
    this.sliders.push({ input, swatch, colour, track, key });
  }

  /**
   * A word for each body; a head wearing it for each hairstyle, drawn by the
   * same renderer as the mirror, so a thumbnail cannot promise what the body
   * will not wear; and a slider for each colour, its track the colours along
   * it and the exact colour chosen beside it.
   */
  private buildChoices(): void {
    const body = this.block('Body');
    for (const g of GENDERS) {
      const b = button('cr-pick cr-word', g.name);
      this.pick(b, 'gender', g.id, g.name, body.label);
      body.row.append(b);
    }
    const hair = this.block('Hair');
    for (const h of HAIRSTYLES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cr-pick cr-face';
      b.title = h.name;
      const canvas = document.createElement('canvas');
      // Drawn at the screen's own resolution, so a haircut is not chosen from a blur.
      canvas.width = canvas.height = Math.round(64 * Math.min(3, window.devicePixelRatio || 1));
      const name = document.createElement('span');
      name.textContent = h.name;
      b.append(canvas, name);
      this.thumbs.push({ canvas, hair: h.id });
      this.pick(b, 'hair', h.id, h.name, hair.label);
      hair.row.append(b);
    }
    this.slider('Hair colour', 'hairColour', hairColour, () => gradientOf(HAIR_RAMP));
    // The grey's track runs from the hair's own colour to white, as the hair does.
    this.slider('Grey', 'hairGrey', hairColour, (l) => `linear-gradient(to right, ${hairColour({ ...l, hairGrey: 0 })}, ${HAIR_WHITE})`);
    this.slider('Skin', 'skin', skinColour, () => gradientOf(SKIN_RAMP));
  }

  /** The marks, the sliders and the thumbnails, from the one look. The mirror redraws itself every frame. */
  private redraw(): void {
    for (const m of this.marks) {
      const on = this.chosen[m.kind] === m.id;
      m.button.classList.toggle('on', on);
      m.button.setAttribute('aria-pressed', String(on));
      if (on) m.label.textContent = m.name;
    }
    for (const s of this.sliders) {
      const v = Math.round(this.chosen[s.key] * STEPS);
      if (Number(s.input.value) !== v) s.input.value = String(v);
      const c = s.colour(this.chosen);
      s.swatch.style.background = c;
      s.swatch.title = c;
      s.input.style.setProperty('--cr-track', s.track(this.chosen));
    }
    this.drawThumbs();
  }

  /** Each hairstyle on the chosen body in the chosen colours, its head close. */
  private drawThumbs(): void {
    this.thumbsSculpted = sculptedReady();
    for (const t of this.thumbs) {
      const ctx = t.canvas.getContext('2d');
      if (!ctx) continue;
      ctx.clearRect(0, 0, t.canvas.width, t.canvas.height);
      drawPortrait(ctx, 0, 0, t.canvas.width, t.canvas.height, { ...this.chosen, hair: t.hair }, 0, 1, 'idle', { close: true, outfit: BARE });
    }
  }

  private frame(now: number): void {
    if (!this.shown()) {
      this.walking = 0;
      return;
    }
    const ctx = this.mirror.getContext('2d');
    if (ctx) {
      // The backing store follows the size the page gives the mirror, at the screen's own resolution.
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = Math.round(this.mirror.clientWidth * dpr), h = Math.round(this.mirror.clientHeight * dpr);
      if (w > 0 && h > 0 && (this.mirror.width !== w || this.mirror.height !== h)) {
        this.mirror.width = w;
        this.mirror.height = h;
      }
      ctx.clearRect(0, 0, this.mirror.width, this.mirror.height);
      const shown = this.preview ?? this.chosen;
      drawPortrait(ctx, 0, 0, this.mirror.width, this.mirror.height, shown, now / 1000, this.facing, 'idle',
        { close: this.close, outfit: this.outfit });
    }
    // The thumbnails again once the sculpted bodies have landed.
    if (!this.thumbsSculpted && sculptedReady()) this.drawThumbs();
    this.walking = requestAnimationFrame((t) => this.frame(t));
  }

  private turn(by: number): void {
    this.facing = (((this.facing + by) % 8) + 8) % 8;
  }
}

