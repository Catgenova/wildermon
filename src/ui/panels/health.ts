import { ACTION_BY_ID } from '../../game/actions';
import type { Game } from '../../game/game';
import { lessMotion } from '../../engine/motion';
import { DEFAULT_LOOK } from '../../game/look';
import { gearFrom, wornWire } from '../../game/worn';
import { drawFigure, figureJoint, onScreen, viewOf, type FigurePose, type V3 } from '../../render/figure';
import { svgOf, type Effect, type SpellsOnYou } from '../effects';
import { clockWords, healthReport, type Care, type CareOption, type HealthReport, type RecipeView, type WoundState, type WoundView } from '../health';
import type { UIWindow } from '../windows';
import { fixedAll, html, NO_MARKUP, setMarkup, type Markup } from '../html';
import { WOUND_KINDS } from '../../game/wounds';

/**
 * Health: how you are, what is open on you and what to do about it.
 *
 * Along the top, always in sight: a heart that fills with your health and
 * beats faster the less of it there is, what you are losing or mending a
 * minute, and your stamina, food and water. Under it, on the left, you: your
 * own figure as the island draws it, in what you wear, standing and breathing,
 * with each wound pinned where it is -- bleeding drips to the ground, venom
 * bubbles, a wound gone bad gives off a sickly wisp, and a dressing is bound
 * round it. On the right, three tabs: the wounds, worst first, each opening
 * on what can be done for it, what has to be carried and the button that
 * does it to that wound; what is against you and for you; and how you are
 * eating.
 *
 * The words and numbers are worked out in `src/ui/health.ts`; this draws them.
 */

const SVG = 'http://www.w3.org/2000/svg';

/** The bone each part's wounds are pinned to, and where on it, in the body's own units (`figureJoint`). */
const PART_BONE: Record<string, [string, V3]> = {
  head: ['head', [0, 0, 1.4]],
  chest: ['chest', [0, 0, 0.6]],
  arms: ['arm1', [0, 0, -2.4]],
  offhand: ['wrist0', [0, 0, -0.6]],
  weapon: ['wrist1', [0, 0, -0.6]],
  legs: ['knee0', [0, 0, -2.2]],
  feet: ['ankle1', [0, 0, -0.4]],
};

/** The beat at full health and at none, seconds a beat. */
const BEAT_SLOW = 1.15;
const BEAT_FAST = 0.5;
/** How long a wound's row stays lit after it has been seen to, seconds. */
const SEEN_TO = 1.6;
/** How much of the stage's height the body stands in, and how far its feet are from the stage's foot, CSS px. */
const BODY_SHARE = 0.78;
/** How tall the figure may stand against the stage's width, so the shoulders keep inside it. */
const WIDE_SHARE = 1.5;
/** At or under this width (CSS px) you stand in the top card instead of beside the tabs. */
const NARROW = 430;
/** How short and how tall the stage may be beside the tabs (CSS px). */
const STAGE_MIN = 292, STAGE_MAX = 560;
const FEET_UP = 22;
/** The most frames a second the figure is drawn at. */
const FIGURE_FPS = 30;

type Tab = 'wounds' | 'conditions' | 'food';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};
/** A span of `cls` holding the picture `m`. */
const pictured = (cls: string, m: Markup): HTMLSpanElement => {
  const s = el('span', cls);
  setMarkup(s, m);
  return s;
};
const pct = (x: number): string => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;

/** The heart, as a path in a 100 × 92 box. */
const HEART = 'M50 88 C 20 66 4 48 4 28 C 4 13 16 3 30 3 C 39 3 46 8 50 15 C 54 8 61 3 70 3 C 84 3 96 13 96 28 C 96 48 80 66 50 88 Z';

/** Small pictures of what a care takes, in a 24 × 24 box, drawn in the window's own colours. */
const ITEM_ICONS: Record<string, Markup> = fixedAll({
  bandage: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="9" cy="12" rx="6" ry="7" class="i-cloth"/><ellipse cx="9" cy="12" rx="2.2" ry="2.6" class="i-core"/><path d="M9 5 H19 a2 2 0 0 1 2 2 V9 L17 10 L21 12 V17 a2 2 0 0 1 -2 2 H9" class="i-cloth"/><path d="M13 8.5 h5 M13 15.5 h5" class="i-weave"/></svg>',
  cover: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3" class="i-cloth"/><path d="M8 15 C 9 10 13 8 17 8 C 17 12 14 15 9 15.5 Z" class="i-leaf"/><path d="M9 15 L15 10" class="i-vein"/></svg>',
  lye_bucket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 Q 12 1 18 6" class="i-handle"/><path d="M5 8 H19 L17.5 20 a1.5 1.5 0 0 1 -1.5 1.3 H8 a1.5 1.5 0 0 1 -1.5 -1.3 Z" class="i-wood"/><ellipse cx="12" cy="8" rx="7" ry="1.8" class="i-lye"/><path d="M6.3 12 H17.7 M6.8 16.5 H17.2" class="i-band"/></svg>',
  water_bucket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 Q 12 1 18 6" class="i-handle"/><path d="M5 8 H19 L17.5 20 a1.5 1.5 0 0 1 -1.5 1.3 H8 a1.5 1.5 0 0 1 -1.5 -1.3 Z" class="i-wood"/><ellipse cx="12" cy="8" rx="7" ry="1.8" class="i-water"/><path d="M6.3 12 H17.7 M6.8 16.5 H17.2" class="i-band"/></svg>',
  ash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19 C 5 12 9 9 12 9 C 15 9 19 12 21 19 Z" class="i-ash"/><path d="M8 15 h2 M13 13 h2 M11 17 h3" class="i-ash-fleck"/></svg>',
  herb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 V6" class="i-vein"/><path d="M12 9 C 8 9 6 6 6 3 C 9 3 12 5 12 9 Z M12 13 C 16 13 18 10 18 7 C 15 7 12 9 12 13 Z M12 17 C 8 17 6 14 6 11 C 9 11 12 13 12 17 Z" class="i-leaf"/></svg>',
  cotton: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="10" r="4.5" class="i-fluff"/><circle cx="15" cy="10" r="4.5" class="i-fluff"/><circle cx="12" cy="14.5" r="4.5" class="i-fluff"/><path d="M12 19 V22" class="i-vein"/></svg>',
  cloth: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8 L12 4 L21 8 L21 17 L12 21 L3 17 Z" class="i-cloth"/><path d="M3 8 L12 12 L21 8 M12 12 V21" class="i-weave"/></svg>',
  wax: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10 L12 6 L20 10 V16 L12 20 L4 16 Z" class="i-wax"/><path d="M4 10 L12 14 L20 10 M12 14 V20" class="i-wax-edge"/></svg>',
  knife: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 L10 14" class="i-handle-thick"/><path d="M10 14 L20 4 C 20 9 16 13 12 16 Z" class="i-blade"/></svg>',
  salve: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="9" rx="8" ry="3" class="i-lid"/><path d="M4 9 V16 a8 3 0 0 0 16 0 V9" class="i-tin"/><ellipse cx="12" cy="9" rx="8" ry="3" class="i-lid"/><path d="M9 8.5 C 10 6.5 13 6 15 7" class="i-vein"/></svg>',
});
/** The healing herbs, which share one picture. */
/** Conditions whose rule the mend checklist says under them. */
const SAID_BELOW = new Set(['hunger', 'thirst']);
const HERBS = new Set(Object.values(WOUND_KINDS).map((k) => k.herb));
const icon = (item: string): HTMLSpanElement => {
  const s = el('span', `hp-icon hp-icon-${item}`);
  setMarkup(s, ITEM_ICONS[item] ?? NO_MARKUP);
  return s;
};

/** What is drawn in a wound's pin, so its state reads without its colour: a drop, a fang, a wisp, a wrap or a leaf. */
const PIN_GLYPH: Record<WoundState, Markup> = fixedAll<WoundState>({
  bleeding: '<path d="M6 1.5 C 4 4.5 3 6 3 7.5 a3 3 0 0 0 6 0 C 9 6 8 4.5 6 1.5 Z"/>',
  open: '<path d="M6 1.5 C 4 4.5 3 6 3 7.5 a3 3 0 0 0 6 0 C 9 6 8 4.5 6 1.5 Z"/>',
  venom: '<path stroke="none" fill-rule="evenodd" d="M4.6 4.2 a3.2 3.2 0 1 0 .01 0 Z M3.6 5.6 a.85 .85 0 1 0 .01 0 Z M9 1.9 a2.1 2.1 0 1 0 .01 0 Z M9.4 7.6 a1.35 1.35 0 1 0 .01 0 Z"/>',
  bad: '<path fill-rule="evenodd" stroke="none" d="M6 1.2 a4.3 4.3 0 0 0 -4.3 4.3 c0 1.6 .8 2.7 1.9 3.3 V10.6 h4.8 V8.8 c1.1 -.6 1.9 -1.7 1.9 -3.3 A4.3 4.3 0 0 0 6 1.2 Z M4.4 4.6 a1 1 0 1 0 .01 0 Z M7.6 4.6 a1 1 0 1 0 .01 0 Z"/>',
  dressed: '<path stroke="none" fill-rule="evenodd" transform="rotate(-35 6 6)" d="M2.2 3.6 H9.8 a2.4 2.4 0 0 1 0 4.8 H2.2 a2.4 2.4 0 0 1 0 -4.8 Z M4.6 4.7 H7.4 V7.3 H4.6 Z M2.5 5.6 a.4 .4 0 1 0 .01 0 Z M9.5 5.6 a.4 .4 0 1 0 .01 0 Z"/>',
  covered: '<path d="M2.5 9.5 C 3 5 6 2.5 9.5 2.5 C 9.5 6 7 9 2.5 9.5 Z"/>',
});

/** What a wound's state is called on the legend, in the order it is drawn. */
const STATE_NAMES: Array<[WoundState, string]> = [
  ['bleeding', 'Bleeding'], ['bad', 'Infected'], ['venom', 'Venom'], ['open', 'Open'], ['dressed', 'Dressed'], ['covered', 'Right herb'],
];

/** A drop of blood, a bubble of venom or a wisp off a wound gone bad, on the figure's stage. */
interface Mote {
  kind: 'drop' | 'bubble' | 'wisp';
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  /** Where a drop lands, CSS px down the stage. */
  floor: number;
}

export class HealthPanel {
  private readonly heart: HTMLDivElement;
  private readonly heartFill: SVGRectElement;
  private readonly heartWave: SVGGElement;
  private readonly big: HTMLSpanElement;
  private readonly sum: HTMLSpanElement;
  private readonly emptyIn: HTMLDivElement;
  private readonly emptyText: HTMLSpanElement;
  private readonly rate: HTMLDivElement;
  private readonly pills = new Map<string, { fill: HTMLSpanElement; num: HTMLSpanElement; box: HTMLDivElement }>();
  private readonly stage: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly pins: HTMLDivElement;
  private readonly legend: HTMLDivElement;
  private readonly hands: HTMLDivElement;
  private readonly tabs = new Map<Tab, { btn: HTMLButtonElement; badge: HTMLSpanElement; pane: HTMLDivElement }>();
  private readonly woundsPane: HTMLDivElement;
  private readonly against: HTMLDivElement;
  private readonly forYou: HTMLDivElement;
  private readonly forHead: HTMLDivElement;
  private readonly foodBars: HTMLDivElement;
  private readonly fedWord: HTMLSpanElement;
  private readonly mendLine: HTMLDivElement;
  private readonly foodWords: HTMLDivElement;
  private readonly more: HTMLButtonElement;
  private tab: Tab = 'wounds';
  /** The wound open in the list, by its key (`woundKey`). */
  private picked: string | null = null;
  /** The wound whose care was last drawn open, so a redraw of the same one does not play its opening again. */
  private shownOpen: string | null = null;
  /** "How to make" opened or shut by hand, by wound and care, kept across redraws. */
  private makeOpen = new Map<string, boolean>();
  private report: HealthReport | null = null;
  private drawn = '';
  private lastHealth = -1;
  private lastWounds = new Map<string, string>();
  private seenAt = new Map<string, number>();
  private primed = false;
  private next = 0;
  private frame = 0;
  private lastFigure = 0;
  private motes: Mote[] = [];
  /** Where each wound's pin is on the stage, CSS px, as last drawn. */
  private pinAt = new Map<string, [number, number]>();
  /** "More below" is measured by a ResizeObserver, not after each refresh. */
  private measured = false;
  /** The stage's size in CSS px, as its ResizeObserver last saw it (0 before). */
  private stageW = 0;
  private stageH = 0;
  private get still(): boolean { return lessMotion(); }

  constructor(private readonly win: UIWindow, private readonly game: Game, private readonly spells: SpellsOnYou) {
    win.body.classList.add('hp-body');
    const root = el('div', 'hp');
    win.body.append(root);

    /* ---- along the top: the heart, the line under it, the bars ---------------------- */
    const top = el('header', 'hp-top');
    this.heart = el('div', 'hp-heart');
    const hs = svg('svg', { viewBox: '0 0 100 92', 'aria-hidden': 'true' });
    const defs = svg('defs');
    const clip = svg('clipPath', { id: 'hp-heart-clip' });
    clip.append(svg('path', { d: HEART }));
    const shine = svg('radialGradient', { id: 'hp-heart-shine', cx: '0.32', cy: '0.25', r: '0.8' });
    shine.append(svg('stop', { offset: '0', 'stop-color': 'var(--hp-heart-lit)' }), svg('stop', { offset: '1', 'stop-color': 'var(--hp-heart)' }));
    defs.append(clip, shine);
    const filled = svg('g', { 'clip-path': 'url(#hp-heart-clip)' });
    this.heartFill = svg('rect', { x: 0, y: 0, width: 100, height: 92, fill: 'url(#hp-heart-shine)' });
    this.heartWave = svg('g');
    this.heartWave.append(svg('path', { class: 'hp-heart-wave', d: 'M-100 4 Q -87.5 0 -75 4 T -50 4 T -25 4 T 0 4 T 25 4 T 50 4 T 75 4 T 100 4 T 125 4 T 150 4 V 12 H -100 Z' }));
    filled.append(this.heartFill, this.heartWave);
    hs.append(defs, svg('path', { d: HEART, class: 'hp-heart-back' }), filled, svg('path', { d: HEART, class: 'hp-heart-rim' }),
      svg('ellipse', { cx: 30, cy: 22, rx: 9, ry: 5, class: 'hp-heart-glint', transform: 'rotate(-30 30 22)' }));
    this.heart.append(hs);
    const words = el('div', 'hp-top-words');
    const line = el('div', 'hp-top-line');
    this.big = el('span', 'hp-big', '100%');
    this.sum = el('span', 'hp-sum');
    this.emptyIn = el('div', 'hp-empty-in');
    this.emptyText = el('span');
    this.emptyIn.append(el('span', 'hp-glass'), this.emptyText);
    line.append(this.big, el('span', 'hp-big-label', 'health'), this.sum);
    this.rate = el('div', 'hp-rate');
    this.rate.setAttribute('aria-live', 'polite');
    words.append(line, this.emptyIn, this.rate);
    const pills = el('div', 'hp-pills');
    for (const [id, label] of [['stamina', 'Stamina'], ['hunger', 'Food'], ['thirst', 'Water']] as const) {
      const box = el('div', `hp-pill hp-pill-${id}`);
      const head = el('div', 'hp-pill-head');
      const num = el('span', 'hp-pill-num');
      head.append(el('span', 'hp-pill-label', label), num);
      const track = el('span', 'hp-pill-track');
      const fill = el('span', 'hp-pill-fill');
      track.append(fill);
      box.append(head, track);
      pills.append(box);
      this.pills.set(id, { fill, num, box });
    }
    top.append(this.heart, words, pills);

    /* ---- you ----------------------------------------------------------------------------- */
    const main = el('div', 'hp-main');
    this.stage = el('div', 'hp-stage');
    this.canvas = el('canvas', 'hp-model');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.pins = el('div', 'hp-pins');
    this.legend = el('div', 'hp-legend');
    const plinth = el('div', 'hp-plinth');
    this.stage.append(plinth, this.canvas, this.pins);
    this.hands = el('div', 'hp-hands');
    const stageBox = el('div', 'hp-stage-box');
    stageBox.append(this.stage, this.legend);

    /* ---- the tabs ------------------------------------------------------------------------- */
    const side = el('div', 'hp-side');
    const bar = el('div', 'hp-tabs');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Health');
    const panes = el('div', 'hp-panes');
    for (const [id, label] of [['wounds', 'Wounds'], ['conditions', 'Conditions'], ['food', 'Nutrition']] as const) {
      const btn = el('button', 'hp-tab');
      btn.type = 'button';
      btn.id = `hp-tab-${id}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-controls', `hp-pane-${id}`);
      const badge = el('span', 'hp-badge');
      btn.append(el('span', 'hp-tab-label', label), badge);
      btn.addEventListener('click', () => this.show(id));
      btn.addEventListener('keydown', (e) => {
        const order: Tab[] = ['wounds', 'conditions', 'food'];
        const i = order.indexOf(id);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const to = order[(i + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length];
          this.show(to);
          this.tabs.get(to)?.btn.focus();
        }
      });
      const pane = el('div', 'hp-pane');
      pane.id = `hp-pane-${id}`;
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', btn.id);
      bar.append(btn);
      panes.append(pane);
      this.tabs.set(id, { btn, badge, pane });
    }
    this.woundsPane = el('div', 'hp-list');
    this.woundsPane.setAttribute('role', 'list');
    this.tabs.get('wounds')?.pane.append(this.woundsPane);
    this.against = el('div', 'hp-cards');
    this.forYou = el('div', 'hp-cards');
    this.forHead = el('div', 'hp-head', 'Buffs');
    this.mendLine = el('div', 'hp-mend-rule');
    this.tabs.get('conditions')?.pane.append(el('div', 'hp-head', 'Debuffs'), this.against, this.mendLine, this.forHead, this.forYou,
      el('div', 'hp-head', 'Healing skills'), this.hands);
    const foodHead = el('div', 'hp-head', 'Nutrition');
    this.fedWord = el('span', 'hp-fed');
    this.foodBars = el('div', 'hp-food');
    this.foodWords = el('ul', 'hp-food-words') as unknown as HTMLDivElement;
    this.tabs.get('food')?.pane.append(foodHead, this.fedWord, this.foodBars, this.foodWords);
    side.append(bar, panes);
    main.append(stageBox, side);
    this.more = el('button', 'hp-more', 'More below');
    this.more.type = 'button';
    this.more.hidden = true;
    this.more.addEventListener('click', () => win.body.scrollBy({ top: win.body.clientHeight * 0.7, behavior: this.still ? 'auto' : 'smooth' }));
    root.append(top, main);
    // Over the window's foot, not in what scrolls, so the fade under it does not take it too.
    win.el.append(this.more);
    win.body.addEventListener('scroll', () => this.moreBelow(), { passive: true });
    // Narrow, you stand in the top card beside your numbers with the heart by your health, so the wounds start higher.
    const fit = (): void => {
      const narrow = root.clientWidth > 0 && root.clientWidth <= NARROW;
      if (narrow === root.classList.contains('hp-narrow')) return;
      root.classList.toggle('hp-narrow', narrow);
      if (narrow) {
        top.prepend(stageBox);
        line.prepend(this.heart);
      } else {
        main.prepend(stageBox);
        top.prepend(this.heart);
      }
    };
    // Wide, you stand as tall as the column beside you, up to what the window shows at once, so it is not left empty under you.
    const tall = (): void => {
      if (root.classList.contains('hp-narrow')) {
        main.style.removeProperty('--hp-stage-h');
        return;
      }
      // What shows of the body under the top card at rest, less the foot the "More below" pill takes.
      const shows = win.body.clientHeight - main.offsetTop - 48;
      const room = Math.min(shows, side.offsetHeight) - this.legend.offsetHeight - 6;
      main.style.setProperty('--hp-stage-h', `${Math.round(Math.max(STAGE_MIN, Math.min(STAGE_MAX, room)))}px`);
    };
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        fit();
        tall();
      }).observe(root);
      new ResizeObserver(tall).observe(side);
      // Measured after layout, when what scrolls or the window changes size, not after every write.
      const measure = new ResizeObserver(() => this.moreBelow());
      measure.observe(root);
      measure.observe(win.body);
      new ResizeObserver(() => {
        this.stageW = this.stage.clientWidth;
        this.stageH = this.stage.clientHeight;
      }).observe(this.stage);
      this.measured = true;
    }
    this.show('wounds');

    win.onOpen = () => {
      this.refresh(true);
      this.loop();
    };
    for (const ev of ['stats', 'inventory', 'skill', 'action'] as const) game.events.on(ev as 'stats', () => this.soon());
  }

  /** Drawn again at the next update, not at once: a go can change the pack and the body in one breath. */
  private soon(): void {
    this.next = 0;
  }

  /** Called every frame; the words a few times a second while open. */
  update(now: number): void {
    if (!this.win.isOpen || now < this.next) return;
    this.next = now + 250;
    this.refresh(false);
  }

  private show(tab: Tab): void {
    this.tab = tab;
    for (const [id, t] of this.tabs) {
      const on = id === tab;
      t.btn.setAttribute('aria-selected', String(on));
      t.btn.tabIndex = on ? 0 : -1;
      t.btn.classList.toggle('hp-tab-on', on);
      t.pane.hidden = !on;
    }
    if (this.report) this.refresh(true);
  }

  private pick(key: string, fromPin = false): void {
    this.picked = this.picked === key && !fromPin ? null : key;
    this.show('wounds');
    this.drawn = '';
    this.refresh(true);
    this.woundsPane.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest', behavior: this.still ? 'auto' : 'smooth' });
  }

  refresh(force: boolean): void {
    if (!this.win.isOpen && !force) return;
    const r = healthReport(this.game, this.spells);
    this.report = r;
    this.drawTop(r);
    this.drawWounds(r);
    this.drawHands(r);
    // The other tabs only while they show.
    if (this.tab === 'conditions') {
      // Hunger and thirst only by name and how low: what they stop is the mend checklist's to say, under them.
      this.drawEffects(this.against, r.against.map((e) => (SAID_BELOW.has(e.id) ? { ...e, does: [], from: e.from.replace(/\.$/, '') } : e)), 'None.');
      this.drawEffects(this.forYou, r.forYou, '');
      this.forHead.hidden = this.forYou.hidden = !r.forYou.length;
      const sig = JSON.stringify(r.mend);
      if (this.mendLine.dataset.sig !== sig) {
        this.mendLine.dataset.sig = sig;
        this.mendLine.replaceChildren(el('b', '', r.mend.rate), ...r.mend.needs.map((n) => el('div', `hp-mend-need ${n.ok ? 'hp-mend-ok' : 'hp-mend-no'}`, `${n.ok ? '✓' : '✗'} ${n.text}`)));
      }
    }
    if (this.tab === 'food') this.drawFood(r);
    const set = (t: Tab, n: number | string, hot: boolean): void => {
      const b = this.tabs.get(t)?.badge;
      if (!b) return;
      b.textContent = n ? String(n) : '';
      b.hidden = !n;
      b.classList.toggle('hp-badge-hot', hot);
    };
    set('wounds', r.wounds.length, r.wounds.some((v) => v.state === 'bad' || v.state === 'bleeding' || v.state === 'venom'));
    set('conditions', r.against.length, r.against.length > 0);
    set('food', r.hungry ? '!' : 0, r.hungry);
    if (!this.measured) this.moreBelow();
  }

  /** The hint at the foot while there is more of the window under it than shows. */
  private moreBelow(): void {
    const b = this.win.body;
    const more = b.scrollHeight - b.scrollTop - b.clientHeight > 12;
    this.more.hidden = !more || !this.win.isOpen;
    b.classList.toggle('hp-body-more', more);
    // Just above the foot of the body, wherever each look's frame puts it.
    if (more) this.more.style.setProperty('--hp-more-at', `${this.win.el.clientHeight - b.offsetTop - b.clientHeight + 10}px`);
  }

  /* ---- along the top -------------------------------------------------------------------- */

  private drawTop(r: HealthReport): void {
    const h = Math.max(0, Math.min(1, r.health));
    this.big.textContent = pct(h);
    const top = 4 + (1 - h) * 84;
    this.heartFill.setAttribute('y', String(top));
    this.heartWave.setAttribute('transform', `translate(0 ${top - 4})`);
    this.heart.style.setProperty('--hp-beat', `${(BEAT_FAST + (BEAT_SLOW - BEAT_FAST) * h).toFixed(2)}s`);
    this.heart.classList.toggle('hp-heart-low', h < 0.3);
    this.heart.classList.toggle('hp-heart-hurt', r.losing > 0 || r.venom > 0);
    if (this.lastHealth >= 0 && h > this.lastHealth + 0.009) this.burst();
    this.lastHealth = h;
    // What is wrong, in a few words: how many are bleeding, gone bad, venomous or open.
    const count = (st: WoundState): number => r.wounds.filter((v) => v.state === st).length;
    const bits = [
      [count('bleeding'), 'bleeding'], [count('bad'), 'gone bad'], [count('venom'), 'with venom'], [count('open'), 'open'],
    ].filter(([n]) => (n as number) > 0).map(([n, w]) => `${n} ${w}`);
    this.sum.textContent = r.wounds.length ? (bits.length ? bits.join(' · ') : `${r.wounds.length} dressed`) : '';
    this.sum.classList.toggle('hp-sum-bad', bits.length > 0);
    this.emptyIn.hidden = r.emptyIn === null;
    if (r.emptyIn !== null) {
      this.emptyText.textContent = r.emptyIn <= 0 ? 'Health at 0 now' : `Health 0 in ${clockWords(r.emptyIn)}`;
      if (r.emptyIn > 0) this.emptyText.append(el('span', 'hp-empty-rate', ' at this rate'));
      if (r.venom > 0) this.emptyText.append(el('span', 'hp-empty-note', ' incl. venom'));
    }
    this.rate.replaceChildren(...r.rates.map((x) => {
      // Why nothing mends: a label and a chip a reason, so a narrow window breaks between reasons.
      if (x.parts) {
        const group = el('span', 'hp-rate-group');
        group.title = x.long;
        group.append(el('span', 'hp-rate-label', 'Not mending'), ...x.parts.map((p) => el('span', `hp-rate-chip hp-rate-${x.kind}`, p)));
        return group;
      }
      const chip = el('span', `hp-rate-chip hp-rate-${x.kind}`, x.short);
      chip.title = x.long;
      return chip;
    }));
    this.rate.setAttribute('aria-label', r.rateWords.join(' '));
    for (const [id, v] of [['stamina', r.stamina], ['hunger', r.hunger], ['thirst', r.thirst]] as const) {
      const p = this.pills.get(id);
      if (!p) continue;
      p.fill.style.width = pct(v);
      p.num.textContent = pct(v);
      p.box.classList.toggle('hp-pill-low', v <= 0.2);
    }
  }

  private burst(): void {
    if (this.still) return;
    for (let i = 0; i < 4; i++) {
      const b = el('span', 'hp-burst');
      b.style.setProperty('--dx', `${(i - 1.5) * 9}px`);
      b.style.animationDelay = `${i * 90}ms`;
      setMarkup(b, html`<svg viewBox="0 0 100 92" aria-hidden="true"><path d="${HEART}"/></svg>`);
      this.heart.append(b);
      b.addEventListener('animationend', () => b.remove());
    }
  }

  /* ---- you, on the stage ------------------------------------------------------------------ */

  /** Your pose on the stage: standing, facing out, in your own look and everything you wear. */
  private pose(t: number): FigurePose {
    const p = this.game.player;
    return {
      phase: t * 6,
      moving: false,
      facing: 0,
      swimming: false,
      working: false,
      look: p.look ?? DEFAULT_LOOK,
      gear: gearFrom(wornWire((slot) => this.game.worn(slot))),
    };
  }

  /** The figure, drawn while the window is open, at most `FIGURE_FPS` a second. */
  private loop(): void {
    if (this.frame) return;
    const step = (ms: number): void => {
      this.frame = 0;
      if (!this.win.isOpen) return;
      if (ms - this.lastFigure >= 1000 / FIGURE_FPS) {
        this.lastFigure = ms;
        this.drawStage(ms / 1000);
      }
      if (!this.still) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private stageWide(): number {
    return this.stageW || this.stage.clientWidth;
  }

  private stageTall(): number {
    return this.stageH || this.stage.clientHeight;
  }

  private drawStage(t: number): void {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const c = this.canvas;
    // The stage is as big as the window's layout makes it (`.hp-stage`); the canvas follows it.
    const W = this.stageWide() || 160, H = this.stageTall() || 236;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const pose = this.pose(this.still ? 0 : t);
    const view = viewOf(pose.facing);
    // As big as the stage has room for: the top of the head a little under its top edge.
    const crown = onScreen(view, figureJoint(pose, 'head', [0, 0, 2.6]));
    // As tall as the stage allows, but no wider than it: a tall stage leaves room over the head instead.
    const zoom = Math.min(H * BODY_SHARE, W * WIDE_SHARE) / Math.max(1, -crown[1]);
    const fx = W / 2, fy = H - FEET_UP * (H / 236);
    drawFigure(g, fx, fy, zoom, pose, { ink: 1.3 });
    // Each wound's pin over its bone, and what each is doing there.
    const views = this.report?.wounds ?? [];
    const onPart = new Map<string, number>();
    const at = new Map<string, [number, number]>();
    for (const v of views) {
      const [bone, off] = PART_BONE[v.wound.part] ?? ['chest', [0, 0, 0] as V3];
      const s = onScreen(view, figureJoint(pose, bone, off));
      const n = onPart.get(v.wound.part) ?? 0;
      onPart.set(v.wound.part, n + 1);
      const x = fx + s[0] * zoom + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 12, y = fy + s[1] * zoom;
      at.set(v.key, [x, y]);
      if (v.state === 'dressed' || v.state === 'covered') this.drawWrap(g, x, y, v.state === 'covered');
      if (!this.still) this.spawn(v.state, x, y, fy, t);
    }
    // Kept apart, so two wounds near each other are two pins and not one: pushed sideways until 20 px lie between them.
    const keys = [...at.keys()];
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        const a = at.get(keys[i]) as [number, number], b = at.get(keys[j]) as [number, number];
        const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
        if (d >= 20) continue;
        const push = (20 - d) / 2, ux = d > 0.01 ? dx / d : 1, uy = d > 0.01 ? dy / d : 0;
        a[0] -= ux * push; a[1] -= uy * push;
        b[0] += ux * push; b[1] += uy * push;
      }
    }
    this.pinAt = at;
    this.placePins(views);
    this.drawMotes(g, t);
  }

  /** A dressing bound round the place: two turns of cloth, green-edged when it is the herb that suits it. */
  private drawWrap(g: CanvasRenderingContext2D, x: number, y: number, herb: boolean): void {
    const css = getComputedStyle(this.stage);
    const cloth = css.getPropertyValue('--hp-dress').trim() || '#fbf3df';
    const edge = herb ? css.getPropertyValue('--hp-herb').trim() || '#3f6632' : '#8a7a62';
    g.save();
    g.translate(x, y);
    // Three turns of cloth crossing round the limb, the middle one the other way, each with a fold line along it.
    for (const [dy, a] of [[-4, -0.3], [0, 0.32], [4, -0.3]] as const) {
      g.save();
      g.translate(0, dy);
      g.rotate(a);
      g.beginPath();
      g.roundRect(-7.5, -2, 15, 4, 1.6);
      g.fillStyle = cloth;
      g.fill();
      g.strokeStyle = edge;
      g.lineWidth = 0.9;
      g.stroke();
      g.beginPath();
      g.moveTo(-6, 0);
      g.lineTo(6, 0);
      g.strokeStyle = 'rgba(138, 122, 98, 0.45)';
      g.lineWidth = 0.6;
      g.stroke();
      g.restore();
    }
    // The herb under it shows green at the edge.
    if (herb) {
      g.fillStyle = edge;
      g.beginPath();
      g.ellipse(6.5, -6, 2.6, 1.3, -0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  /** New drops, bubbles and wisps off the wounds that make them, a few a second each. */
  private spawn(state: WoundState, x: number, y: number, floor: number, t: number): void {
    const rate = state === 'bleeding' ? 1.6 : state === 'bad' ? 1.2 : state === 'venom' ? 2.2 : 0;
    if (!rate || Math.random() > rate / FIGURE_FPS) return;
    const r = (k: number): number => (Math.random() - 0.5) * k;
    if (state === 'bleeding') this.motes.push({ kind: 'drop', x: x + r(4), y: y + 3, vx: r(4), vy: 6, born: t, life: 3, floor: floor + r(6) });
    else if (state === 'venom') this.motes.push({ kind: 'bubble', x: x + r(8), y, vx: r(6), vy: -14, born: t, life: 1.4, floor });
    else this.motes.push({ kind: 'wisp', x: x + r(6), y, vx: r(5), vy: -9, born: t, life: 2, floor });
    if (this.motes.length > 60) this.motes.shift();
  }

  private drawMotes(g: CanvasRenderingContext2D, t: number): void {
    const css = getComputedStyle(this.stage);
    const blood = css.getPropertyValue('--hp-blood').trim() || '#b8373a';
    const venom = css.getPropertyValue('--hp-venom').trim() || '#7d48a8';
    const bad = css.getPropertyValue('--hp-bad').trim() || '#5f8a2c';
    this.motes = this.motes.filter((m) => t - m.born < m.life);
    for (const m of this.motes) {
      const age = t - m.born, u = age / m.life;
      if (m.kind === 'drop') {
        // Falling, faster as it goes, and a small splash where it lands, spreading and fading.
        const fall = m.y + m.vy * age + 140 * age * age;
        if (fall < m.floor) {
          g.fillStyle = blood;
          g.beginPath();
          g.ellipse(m.x + m.vx * age, fall, 1.6, 2.4, 0, 0, Math.PI * 2);
          g.fill();
        } else {
          const since = age - (-m.vy + Math.sqrt(m.vy * m.vy + 560 * (m.floor - m.y))) / 280;
          g.globalAlpha = Math.max(0, 0.8 - since * 0.35);
          g.fillStyle = blood;
          g.beginPath();
          g.ellipse(m.x + m.vx * age, m.floor, 2 + since * 2.2, 0.9 + since * 0.5, 0, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
        }
      } else if (m.kind === 'bubble') {
        g.globalAlpha = Math.sin(Math.PI * u) * 0.85;
        g.strokeStyle = venom;
        g.fillStyle = venom;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(m.x + m.vx * age + Math.sin(age * 9) * 1.5, m.y + m.vy * age, 1.4 + u * 1.6, 0, Math.PI * 2);
        g.globalAlpha *= 0.35;
        g.fill();
        g.globalAlpha /= 0.35;
        g.stroke();
        g.globalAlpha = 1;
      } else {
        g.globalAlpha = Math.sin(Math.PI * u) * 0.5;
        g.strokeStyle = bad;
        g.lineWidth = 1.6;
        g.lineCap = 'round';
        const x0 = m.x + m.vx * age, y0 = m.y + m.vy * age;
        g.beginPath();
        g.moveTo(x0, y0);
        g.bezierCurveTo(x0 + 3, y0 - 3, x0 - 3, y0 - 6, x0 + Math.sin(age * 3) * 2, y0 - 9);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
  }

  /** The pins, as buttons over the figure, one a wound, moved to where each wound is drawn. */
  private placePins(views: WoundView[]): void {
    const have = new Map([...this.pins.children].map((b) => [(b as HTMLElement).dataset.key ?? '', b as HTMLButtonElement]));
    for (const v of views) {
      let b = have.get(v.key);
      if (!b) {
        b = el('button', 'hp-pin');
        b.type = 'button';
        b.dataset.key = v.key;
        b.append(el('span', 'hp-pin-ring'), el('span', 'hp-pin-dot'));
        b.dataset.state = '';
        b.addEventListener('click', () => this.pick(v.key, true));
        this.pins.append(b);
      }
      have.delete(v.key);
      const [x, y] = this.pinAt.get(v.key) ?? [this.stageWide() / 2, this.stageTall() / 2];
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      b.className = `hp-pin hp-pin-${v.state}${v.key === this.picked ? ' hp-pin-picked' : ''}`;
      if (b.dataset.state !== v.state) {
        b.dataset.state = v.state;
        const dot = b.querySelector('.hp-pin-dot');
        if (dot) setMarkup(dot, html`<svg viewBox="0 0 12 12" aria-hidden="true">${PIN_GLYPH[v.state]}</svg>`);
      }
      const name = `${v.title} on your ${v.part}`;
      b.title = name;
      b.setAttribute('aria-label', `${name}: ${v.tags[0] ?? ''}`);
    }
    for (const b of have.values()) b.remove();
  }

  /* ---- the wounds ------------------------------------------------------------------------- */

  private drawWounds(r: HealthReport): void {
    const now = performance.now() / 1000;
    const states = new Map(r.wounds.map((v) => [v.key, `${v.state}|${v.wound.dressing}|${v.wound.salved ? 1 : 0}`]));
    for (const [key, s] of states) {
      const was = this.lastWounds.get(key);
      if (was !== undefined && was !== s) this.seenAt.set(key, now);
      if (was === undefined && this.primed) this.flinch();
    }
    this.lastWounds = states;
    this.primed = true;
    if (this.picked && !states.has(this.picked)) this.picked = null;
    // The worst open by itself the first time there is one, so the window opens on what wants doing.
    if (!this.picked && r.wounds.length && !this.drawn) this.picked = r.wounds[0].key;
    this.legend.textContent = r.wounds.length ? 'Tap a pin or wound to treat' : 'No wounds';
    const a = this.game.action;
    const doing = a && a.state === 'performing' && a.target.kind === 'item' && a.target.wound ? { key: a.target.wound, id: a.def.id, k: a.elapsed / Math.max(0.001, a.duration), left: Math.max(0, a.duration - a.elapsed) } : null;
    const sig = JSON.stringify([this.picked, doing && [doing.key, doing.id, Math.round(doing.k * 50)], r.wounds.map((v) => [v.key, v.state, v.title, v.tags, v.eta, v.severity.toFixed(2),
      v.cares.map((c) => [c.id, c.why, c.have, c.make, c.target ? 1 : 0, c.options.map((o) => [o.have, o.chosen])])]),
      [...this.seenAt.entries()].filter(([, t]) => now - t < SEEN_TO).map(([k]) => k)]);
    if (sig === this.drawn) return;
    this.drawn = sig;
    if (!r.wounds.length) {
      const empty = el('div', 'hp-empty');
      empty.append(el('div', 'hp-empty-mark'), el('b', '', 'No wounds.'), el('div', '', r.rateWords.join(' ')));
      this.woundsPane.replaceChildren(empty);
      return;
    }
    // Redrawn as the numbers move: keep the focus where it was.
    const had = this.woundsPane.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined;
    this.woundsPane.replaceChildren(...r.wounds.map((v) => this.woundRow(v, now, doing && doing.key === v.key ? doing : null)));
    this.shownOpen = this.picked;
    if (had) this.woundsPane.querySelector<HTMLElement>(`[data-focus="${CSS.escape(had)}"]`)?.focus({ preventScroll: true });
  }

  private flinch(): void {
    this.stage.classList.remove('hp-flinch');
    void this.stage.getBoundingClientRect();
    this.stage.classList.add('hp-flinch');
  }

  private woundRow(v: WoundView, now: number, doing: { id: string; k: number; left: number } | null): HTMLElement {
    const open = v.key === this.picked;
    const box = el('div', `hp-wound hp-wound-${v.state}${open ? ' hp-wound-open' : ''}`);
    box.dataset.key = v.key;
    box.setAttribute('role', 'listitem');
    const seen = this.seenAt.get(v.key);
    if (seen !== undefined && now - seen < SEEN_TO) box.classList.add('hp-wound-seen');
    const head = el('button', 'hp-wound-head');
    head.type = 'button';
    head.dataset.focus = `${v.key}|head`;
    head.setAttribute('aria-expanded', String(open));
    const name = el('span', 'hp-wound-name');
    name.append(el('b', '', v.title), el('span', 'hp-wound-part', ` · ${v.part}`));
    const state = el('span', `hp-chip hp-chip-${v.state}`, STATE_NAMES.find(([st]) => st === v.state)?.[1] ?? '');
    const sev = el('span', 'hp-wound-depth');
    const track = el('span', 'hp-wound-sev');
    const sf = el('span', 'hp-wound-sev-fill');
    sf.style.width = pct(v.severity);
    track.append(sf);
    const depth = el('span', 'hp-wound-depth-label', 'Depth ');
    depth.append(el('b', '', v.depth), ' of full health');
    sev.append(depth, track);
    head.append(el('span', 'hp-wound-dot'), name, state, sev, el('span', 'hp-wound-tags', v.tags.join(' · ')), el('span', 'hp-wound-eta', v.eta));
    // Folded, the next thing to do for it, so the list can be read without opening every one.
    if (!open && v.cares.length) {
      const c = v.cares[0];
      const next = el('span', `hp-wound-next ${c.why === null ? 'hp-wound-next-go' : 'hp-wound-next-need'}`);
      next.textContent = c.why === null ? `${c.button}: uses your ${c.uses?.label ?? 'dressing'}` : c.holding ? c.why : `${c.button}: needs ${c.options.length > 1 ? 'a dressing' : `a ${c.options[0].label.toLowerCase()}`}`;
      head.append(next);
    }
    head.addEventListener('click', () => this.pick(v.key));
    box.append(head);
    if (open) box.append(this.treat(v, doing, this.shownOpen !== v.key));
    return box;
  }

  private treat(v: WoundView, doing: { id: string; k: number; left: number } | null, opening: boolean): HTMLElement {
    const block = el('div', `hp-treat${opening ? ' hp-treat-opening' : ''}`);
    if (!v.cares.length) {
      const done = el('div', 'hp-treat-done');
      done.append(icon('cover'), el('span', '', `Right herb: fastest closing, cannot fester. ${v.eta}`));
      block.append(done);
      return block;
    }
    for (const c of v.cares) block.append(this.careBox(c, v, doing && doing.id === c.id ? doing : null));
    return block;
  }

  private careBox(c: Care, v: WoundView, doing: { k: number; left: number } | null): HTMLElement {
    const box = el('section', `hp-care${c.why === null ? ' hp-care-ready' : ''}`);
    const head = el('div', 'hp-care-head');
    const title = el('div', 'hp-care-title');
    title.append(el('b', '', c.title));
    if (c.uses) title.append(el('span', 'hp-care-uses', `Uses: ${c.uses.label}, QL ${c.uses.ql.toFixed(0)}`));
    // Locked for want of something: the button says what, since a tooltip is out of reach on a touch screen.
    const wants = c.why !== null && !c.holding ? `Needs ${c.options.length > 1 ? 'a dressing' : c.options[0].label.toLowerCase()}` : null;
    const go = el('button', 'hp-go', doing ? 'Working…' : wants ?? c.button);
    go.type = 'button';
    go.dataset.focus = `${v.key}|${c.id}`;
    go.disabled = c.why !== null || !c.target || !!doing;
    if (c.why) {
      go.title = c.why;
      go.prepend(el('span', 'hp-lock'));
    }
    go.setAttribute('aria-label', `${c.title}: ${v.title} on your ${v.part}${c.why ? ` (${c.why})` : ''}`);
    go.addEventListener('click', () => {
      const def = ACTION_BY_ID.get(c.id);
      if (!def || !c.target) return;
      this.game.requestAction(def, c.target, 1);
      this.soon();
    });
    head.append(title, go);
    box.append(head);
    if (doing) {
      const bar = el('div', 'hp-progress');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuenow', String(Math.round(doing.k * 100)));
      const f = el('span', 'hp-progress-fill');
      f.style.width = pct(doing.k);
      bar.append(f, el('span', 'hp-progress-left', `${Math.ceil(doing.left)}s`));
      box.append(bar);
    }
    if (c.effect) box.append(el('div', 'hp-care-effect', c.effect));
    // What comes of it, taken and missed, each with its chance.
    if (c.odds.length) {
      const odds = el('div', 'hp-odds');
      for (const o of c.odds) {
        const line = el('div', `hp-odd ${o.ok ? 'hp-odd-ok' : 'hp-odd-no'}`);
        const at = el('span', 'hp-odd-at');
        at.append(el('span', 'hp-odd-mark', o.ok ? '✓' : '✗'), el('b', 'hp-odd-chance', o.chance));
        line.append(at, el('span', 'hp-odd-text', o.text));
        odds.append(line);
      }
      box.append(odds);
    }
    // Something other than a missing thing in the way: said once, here. A missing thing is said by its row.
    if (c.why && c.holding) box.append(el('div', 'hp-why', c.why));
    // What could be held for it, best first: what each does for this wound, and how many you carry.
    const table = el('div', 'hp-opts');
    table.setAttribute('role', 'table');
    const many = c.options.length > 1;
    const numbers = c.options.some((o) => o.closes);
    table.classList.toggle('hp-opts-numbers', numbers);
    const cols = el('div', 'hp-opts-head');
    cols.setAttribute('role', 'row');
    cols.append(el('span', 'hp-opts-what', 'Carried'));
    if (numbers) cols.append(el('span', 'hp-opts-num', 'Heals'), el('span', 'hp-opts-num', 'Closes in'), el('span', 'hp-opts-num', 'Fester'));
    cols.append(el('span', 'hp-opts-num', 'Have'));
    table.append(cols);
    for (const o of c.options) table.append(this.optionRow(o, many, numbers));
    box.append(table);
    if (c.recipes.length) {
      const make = el('details', 'hp-make');
      const sum = el('summary', '', 'Recipe');
      const body = el('div', 'hp-make-body');
      for (const rv of c.recipes) body.append(this.recipeRow(rv));
      make.append(sum, body);
      const kept = `${v.key}|${c.id}`;
      make.open = this.makeOpen.get(kept) ?? !c.holding;
      make.addEventListener('toggle', () => this.makeOpen.set(kept, make.open));
      sum.dataset.focus = `${kept}|make`;
      box.append(make);
    }
    return box;
  }

  private optionRow(o: CareOption, many: boolean, numbers: boolean): HTMLElement {
    const row = el('div', `hp-opt${o.chosen ? ' hp-opt-chosen' : ''}${o.have ? '' : many ? ' hp-opt-none' : ' hp-opt-need'}`);
    row.setAttribute('role', 'row');
    const name = el('div', 'hp-opt-name');
    name.setAttribute('role', 'cell');
    name.append(el('b', '', o.label));
    const have = el('div', `hp-opt-have${o.have ? ' hp-opt-have-yes' : many ? '' : ' hp-opt-have-need'}`);
    have.append(el('b', '', many ? String(o.have) : `${o.have} / 1`));
    have.setAttribute('role', 'cell');
    have.title = `Carried: ${o.have}`;
    row.append(icon(o.item), name);
    if (numbers) {
      const heals = el('div', 'hp-opt-num', o.heals ?? '–');
      heals.title = 'Health restored on this wound, at the carried QL';
      const closes = el('div', 'hp-opt-num', o.closes ?? '–');
      closes.title = 'Time to close under it';
      row.append(heals);
      const turns = el('div', `hp-opt-num${o.turns === '0%' ? ' hp-opt-num-good' : ''}`, o.turns ?? '–');
      turns.title = 'Fester chance under it, vs an open wound';
      row.append(closes, turns);
    }
    row.append(have);
    // The one that goes on: a tick on its picture. With the numbers in columns, the words are its title; alone, a line under it.
    if (o.chosen && many) {
      row.querySelector('.hp-icon')?.append(el('span', 'hp-opt-tick', '✓'));
      row.title = `Uses this: ${o.does}`;
    } else row.title = o.does;
    if (!numbers) row.append(el('div', 'hp-opt-does', o.does));
    return row;
  }

  /** A recipe: its inputs against what you carry, its tool, its trade and level, and what it makes. */
  private recipeRow(rv: RecipeView): HTMLElement {
    const row = el('div', 'hp-recipe');
    const head = el('div', 'hp-recipe-head');
    head.append(el('b', '', rv.title), el('span', 'hp-recipe-makes', `makes ${rv.makes}`));
    const chips = el('div', 'hp-recipe-chips');
    for (const i of rv.inputs) {
      const ok = i.have >= i.need;
      const chip = el('span', `hp-rchip ${ok ? 'hp-rchip-ok' : 'hp-rchip-no'}`);
      const pic = ITEM_ICONS[i.item] ?? (HERBS.has(i.item) ? ITEM_ICONS.herb : null);
      if (pic) chip.append(pictured('hp-rchip-icon', pic));
      chip.append(`${i.name} ${Math.min(i.have, 99)}/${i.need}`);
      chips.append(chip);
    }
    if (rv.tool) {
      const chip = el('span', `hp-rchip ${rv.tool.have ? 'hp-rchip-ok' : 'hp-rchip-no'}`);
      chip.append(pictured('hp-rchip-icon', ITEM_ICONS.knife), `${rv.tool.name} ${rv.tool.have ? '✓' : '✗'}`);
      chips.append(chip);
    }
    chips.append(el('span', 'hp-rchip hp-rchip-skill', `${rv.skill.name} ${rv.skill.level.toFixed(1)}`));
    row.append(head, chips);
    if (rv.who) row.append(el('div', 'hp-recipe-who', `Made only by: ${rv.who}.`));
    return row;
  }

  /** Your first aid and chirurgy under the figure, and what each does for you now. */
  private drawHands(r: HealthReport): void {
    const sig = JSON.stringify(r.hands);
    if (this.hands.dataset.sig === sig) return;
    this.hands.dataset.sig = sig;
    this.hands.replaceChildren(...r.hands.map((h) => {
      const row = el('div', 'hp-hand');
      const head = el('div', 'hp-hand-head');
      head.append(el('span', '', h.name), el('b', '', h.level.toFixed(1)));
      row.append(head, el('div', 'hp-hand-does', h.does), el('div', 'hp-hand-next', h.next));
      return row;
    }));
  }

  /* ---- conditions and food -------------------------------------------------------------- */

  private drawEffects(into: HTMLElement, list: Effect[], none: string): void {
    const sig = JSON.stringify(list.map((e) => [e.id, e.name, e.caption, e.does]));
    if (into.dataset.sig === sig) return;
    into.dataset.sig = sig;
    if (!list.length) {
      into.replaceChildren(el('div', 'hp-none', none));
      return;
    }
    into.replaceChildren(...list.map((e) => {
      const row = el('div', `hp-card ${e.good ? 'hp-card-good' : 'hp-card-bad'}`);
      const ic = el('span', 'hp-card-icon');
      setMarkup(ic, svgOf(e.glyph as Parameters<typeof svgOf>[0]));
      const text = el('div', 'hp-card-text');
      const name = el('div', 'hp-card-name');
      name.append(el('b', '', e.name));
      if (e.caption) name.append(el('span', 'hp-card-cap', e.caption));
      text.append(name, ...e.does.map((d) => el('div', 'hp-card-does', d)), el('div', 'hp-card-from', e.from));
      row.append(ic, text);
      return row;
    }));
  }

  private drawFood(r: HealthReport): void {
    this.fedWord.textContent = r.fed;
    const sig = r.nutrition.map((n) => n.value.toFixed(2)).join() + r.nutritionWords.join();
    if (this.foodBars.dataset.sig === sig) return;
    this.foodBars.dataset.sig = sig;
    this.foodBars.replaceChildren(...r.nutrition.map((n) => {
      const row = el('div', `hp-nut hp-nut-${n.id}`);
      const track = el('span', 'hp-nut-track');
      const fill = el('span', 'hp-nut-fill');
      fill.style.width = pct(n.value);
      track.append(fill);
      row.append(el('span', 'hp-nut-name', n.name), track, el('span', 'hp-nut-num', pct(n.value)), el('span', 'hp-nut-note', n.note));
      return row;
    }));
    this.foodWords.replaceChildren(...r.nutritionWords.map((w) => el('li', '', w)));
  }
}
