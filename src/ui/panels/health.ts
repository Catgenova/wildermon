import { ACTION_BY_ID } from '../../game/actions';
import type { Game } from '../../game/game';
import { svgOf, type Effect, type SpellsOnYou } from '../effects';
import { healthReport, type Care, type HealthReport, type WoundView } from '../health';
import type { UIWindow } from '../windows';

/**
 * Health: how you are, what is open on you and what to do about it.
 *
 * A heart at the top fills with your health and beats faster the less of it
 * there is; a little figure beside your wounds wears each one where it is,
 * bleeding, swollen with venom, gone green or bound up; and a wound clicked,
 * on the figure or in the list, opens what can be done for it, with what has
 * to be carried for each and the button that does it. Under those, what is
 * against you and for you, and how well you are eating.
 *
 * The words and numbers are worked out in `src/ui/health.ts`; this draws them.
 */

const SVG = 'http://www.w3.org/2000/svg';

/** Where on the figure each part's wounds are drawn, in its 100 × 160 box. */
const PART_AT: Record<string, [number, number]> = {
  head: [50, 22],
  chest: [50, 64],
  arms: [27, 66],
  offhand: [20, 98],
  weapon: [80, 98],
  legs: [41, 120],
  feet: [40, 150],
};

/** The beat at full health and at none, seconds a beat. */
const BEAT_SLOW = 1.15;
const BEAT_FAST = 0.5;

/** How long a wound's row stays lit after it has been seen to, seconds. */
const SEEN_TO = 1.6;

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
const pct = (x: number): string => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;

/** The heart, as a path in a 100 × 92 box. */
const HEART = 'M50 88 C 20 66 4 48 4 28 C 4 13 16 3 30 3 C 39 3 46 8 50 15 C 54 8 61 3 70 3 C 84 3 96 13 96 28 C 96 48 80 66 50 88 Z';

export class HealthPanel {
  private readonly root: HTMLDivElement;
  private readonly heart: HTMLDivElement;
  private readonly heartFill: SVGRectElement;
  private readonly heartWave: SVGGElement;
  private readonly big: HTMLDivElement;
  private readonly rate: HTMLDivElement;
  private readonly bars = new Map<string, { fill: HTMLSpanElement; num: HTMLSpanElement }>();
  private readonly woundHead: HTMLDivElement;
  private readonly figure: SVGSVGElement;
  private readonly figureMarks: SVGGElement;
  private readonly face: { mouth: SVGPathElement; eyes: SVGGElement };
  private readonly list: HTMLDivElement;
  private readonly ails: HTMLDivElement;
  private readonly boons: HTMLDivElement;
  private readonly food: HTMLDivElement;
  private readonly fedWord: HTMLSpanElement;
  private readonly foodWords: HTMLDivElement;
  /** The wound open in the list, by its key (`woundKey`). */
  private picked: string | null = null;
  /** What each wound was last drawn as, so a change is drawn once and a wound seen to can light up. */
  private drawn = '';
  private lastHealth = -1;
  private lastWounds = new Map<string, string>();
  private seenAt = new Map<string, number>();
  /** Whether the wounds have been looked at once, so the first look flinches at nothing. */
  private primed = false;
  private next = 0;

  constructor(private readonly win: UIWindow, private readonly game: Game, private readonly spells: SpellsOnYou) {
    win.body.classList.add('hp-body');
    this.root = el('div', 'hp');
    win.body.append(this.root);

    /* ---- the heart and the bars -------------------------------------------- */
    const vitals = el('section', 'hp-vitals');
    vitals.setAttribute('aria-label', 'How you are');
    this.heart = el('div', 'hp-heart');
    const hs = svg('svg', { viewBox: '0 0 100 92', 'aria-hidden': 'true' });
    const defs = svg('defs');
    const clip = svg('clipPath', { id: 'hp-heart-clip' });
    clip.append(svg('path', { d: HEART }));
    const shine = svg('radialGradient', { id: 'hp-heart-shine', cx: '0.32', cy: '0.25', r: '0.8' });
    shine.append(svg('stop', { offset: '0', 'stop-color': 'var(--hp-heart-lit)' }), svg('stop', { offset: '1', 'stop-color': 'var(--hp-heart)' }));
    defs.append(clip, shine);
    const back = svg('path', { d: HEART, class: 'hp-heart-back' });
    const filled = svg('g', { 'clip-path': 'url(#hp-heart-clip)' });
    this.heartFill = svg('rect', { x: 0, y: 0, width: 100, height: 92, class: 'hp-heart-fill', fill: 'url(#hp-heart-shine)' });
    // The surface of what is in it, rolling gently.
    this.heartWave = svg('g');
    this.heartWave.append(svg('path', { class: 'hp-heart-wave', d: 'M-100 4 Q -87.5 0 -75 4 T -50 4 T -25 4 T 0 4 T 25 4 T 50 4 T 75 4 T 100 4 T 125 4 T 150 4 V 12 H -100 Z' }));
    filled.append(this.heartFill, this.heartWave);
    const rim = svg('path', { d: HEART, class: 'hp-heart-rim' });
    const glint = svg('ellipse', { cx: 30, cy: 22, rx: 9, ry: 5, class: 'hp-heart-glint', transform: 'rotate(-30 30 22)' });
    hs.append(defs, back, filled, rim, glint);
    this.heart.append(hs);
    const words = el('div', 'hp-vital-words');
    const line = el('div', 'hp-vital-line');
    this.big = el('div', 'hp-big', '100%');
    line.append(this.big, el('span', 'hp-big-label', 'Health'));
    this.rate = el('div', 'hp-rate');
    this.rate.setAttribute('aria-live', 'polite');
    const bars = el('div', 'hp-bars');
    for (const [id, label] of [['stamina', 'Stamina'], ['hunger', 'Food'], ['thirst', 'Water']] as const) {
      const row = el('div', `hp-bar hp-bar-${id}`);
      const track = el('span', 'hp-bar-track');
      const fill = el('span', 'hp-bar-fill');
      track.append(fill);
      const num = el('span', 'hp-bar-num');
      row.append(el('span', 'hp-bar-label', label), track, num);
      bars.append(row);
      this.bars.set(id, { fill, num });
    }
    words.append(line, this.rate, bars);
    vitals.append(this.heart, words);

    /* ---- the wounds -------------------------------------------------------- */
    const wounds = el('section', 'hp-wounds');
    this.woundHead = el('div', 'hp-head', 'Wounds');
    const lay = el('div', 'hp-wound-lay');
    this.figure = svg('svg', { viewBox: '0 0 100 164', class: 'hp-figure', role: 'img' });
    const body = svg('g', { class: 'hp-figure-body' });
    // A soft little figure: head, body, arms, hands, legs and feet.
    body.append(
      svg('rect', { x: 34, y: 117, width: 13, height: 33, rx: 6.5, class: 'hp-part', 'data-part': 'legs' }),
      svg('rect', { x: 53, y: 117, width: 13, height: 33, rx: 6.5, class: 'hp-part', 'data-part': 'legs' }),
      svg('ellipse', { cx: 40, cy: 152, rx: 9, ry: 5, class: 'hp-part', 'data-part': 'feet' }),
      svg('ellipse', { cx: 60, cy: 152, rx: 9, ry: 5, class: 'hp-part', 'data-part': 'feet' }),
      svg('rect', { x: 18, y: 50, width: 12, height: 44, rx: 6, class: 'hp-part', 'data-part': 'arms', transform: 'rotate(10 24 50)' }),
      svg('rect', { x: 70, y: 50, width: 12, height: 44, rx: 6, class: 'hp-part', 'data-part': 'arms', transform: 'rotate(-10 76 50)' }),
      svg('circle', { cx: 20, cy: 98, r: 6.5, class: 'hp-part', 'data-part': 'offhand' }),
      svg('circle', { cx: 80, cy: 98, r: 6.5, class: 'hp-part', 'data-part': 'weapon' }),
      svg('path', { d: 'M32 52 Q 32 44 42 43 L 58 43 Q 68 44 68 52 L 66 116 Q 50 122 34 116 Z', class: 'hp-part', 'data-part': 'chest' }),
      svg('circle', { cx: 50, cy: 22, r: 17, class: 'hp-part', 'data-part': 'head' }),
    );
    // A face that minds how you are: it blinks, and smiles or frowns with your health.
    const eyes = svg('g', { class: 'hp-eyes' });
    eyes.append(svg('ellipse', { cx: 44, cy: 21, rx: 1.8, ry: 2.3 }), svg('ellipse', { cx: 56, cy: 21, rx: 1.8, ry: 2.3 }));
    const cheeks = svg('g', { class: 'hp-cheeks' });
    cheeks.append(svg('ellipse', { cx: 40, cy: 27, rx: 3, ry: 1.8 }), svg('ellipse', { cx: 60, cy: 27, rx: 3, ry: 1.8 }));
    const mouth = svg('path', { class: 'hp-mouth', d: 'M45 29 Q 50 33 55 29' });
    this.face = { mouth, eyes };
    this.figureMarks = svg('g', { class: 'hp-marks' });
    this.figure.append(body, eyes, cheeks, mouth, this.figureMarks);
    this.figure.addEventListener('click', (e) => {
      const mark = (e.target as Element).closest('[data-key]');
      if (mark instanceof SVGElement && mark.dataset.key) this.pick(mark.dataset.key);
    });
    this.list = el('div', 'hp-list');
    this.list.setAttribute('role', 'list');
    lay.append(this.figure, this.list);
    wounds.append(this.woundHead, lay);

    /* ---- against you, for you ---------------------------------------------- */
    const ailSec = el('section', 'hp-ails-sec');
    this.ails = el('div', 'hp-ails');
    this.boons = el('div', 'hp-ails hp-boons');
    ailSec.append(el('div', 'hp-head', 'Against you'), this.ails, el('div', 'hp-head', 'For you'), this.boons);

    /* ---- nutrition ----------------------------------------------------------- */
    const foodSec = el('section', 'hp-food-sec');
    const foodHead = el('div', 'hp-head', 'Nutrition');
    this.fedWord = el('span', 'hp-fed');
    foodHead.append(this.fedWord);
    this.food = el('div', 'hp-food');
    this.foodWords = el('div', 'hp-food-words');
    foodSec.append(foodHead, this.food, this.foodWords);

    this.root.append(vitals, wounds, ailSec, foodSec);

    win.onOpen = () => this.refresh(true);
    for (const ev of ['stats', 'inventory', 'skill'] as const) game.events.on(ev, () => this.soon());
  }

  /** Drawn again at the next update, not at once: a go can change the pack and the body in one breath. */
  private soon(): void {
    this.next = 0;
  }

  /** Called every frame; draws only while open, a few times a second. */
  update(now: number): void {
    if (!this.win.isOpen || now < this.next) return;
    this.next = now + 250;
    this.refresh(false);
  }

  private pick(key: string): void {
    this.picked = this.picked === key ? null : key;
    this.drawn = '';
    this.refresh(true);
    // The row opened, brought into view.
    this.list.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  refresh(force: boolean): void {
    if (!this.win.isOpen && !force) return;
    const r = healthReport(this.game, this.spells);
    this.drawVitals(r);
    this.drawWounds(r);
    this.drawEffects(this.ails, r.against, 'Nothing is against you.');
    this.drawEffects(this.boons, r.forYou, 'Nothing is helping you just now.');
    this.drawFood(r);
  }

  /* ---- drawing ------------------------------------------------------------------ */

  private drawVitals(r: HealthReport): void {
    const h = Math.max(0, Math.min(1, r.health));
    this.big.textContent = pct(h);
    // What is in the heart: its surface at the health's height, rolling.
    const top = 4 + (1 - h) * 84;
    this.heartFill.setAttribute('y', String(top));
    this.heartWave.setAttribute('transform', `translate(0 ${top - 4})`);
    this.heart.style.setProperty('--hp-beat', `${(BEAT_FAST + (BEAT_SLOW - BEAT_FAST) * h).toFixed(2)}s`);
    this.heart.classList.toggle('hp-heart-low', h < 0.3);
    this.heart.classList.toggle('hp-heart-hurt', r.losing > 0 || r.venom > 0);
    this.heart.title = `${pct(h)} health`;
    // A little burst of hearts when it goes up.
    if (this.lastHealth >= 0 && h > this.lastHealth + 0.009) this.burst();
    this.lastHealth = h;
    this.rate.replaceChildren(...r.rateWords.map((w) => el('div', /^(Losing|Venom)/.test(w) ? 'hp-rate-bad' : '', w)));
    for (const [id, v] of [['stamina', r.stamina], ['hunger', r.hunger], ['thirst', r.thirst]] as const) {
      const b = this.bars.get(id);
      if (!b) continue;
      b.fill.style.width = pct(v);
      b.num.textContent = pct(v);
    }
    // The figure's face: a smile while well, flat when worn, a frown when hurt badly.
    const curve = h > 0.7 ? 4 : h > 0.35 ? 0.5 : -3;
    this.face.mouth.setAttribute('d', `M45 ${h > 0.35 ? 29 : 31} Q 50 ${(h > 0.35 ? 29 : 31) + curve} 55 ${h > 0.35 ? 29 : 31}`);
    this.figure.classList.toggle('hp-figure-weak', h < 0.3);
  }

  private burst(): void {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < 4; i++) {
      const b = el('span', 'hp-burst');
      b.style.setProperty('--dx', `${(i - 1.5) * 9}px`);
      b.style.animationDelay = `${i * 90}ms`;
      b.innerHTML = '<svg viewBox="0 0 100 92" aria-hidden="true"><path d="' + HEART + '"/></svg>';
      this.heart.append(b);
      b.addEventListener('animationend', () => b.remove());
    }
  }

  private drawWounds(r: HealthReport): void {
    this.woundHead.textContent = r.wounds.length ? `Wounds · ${r.wounds.length}` : 'Wounds';
    // A wound whose dressing or state changed has just been seen to (or got worse): note when, to light its row.
    const now = performance.now() / 1000;
    const states = new Map(r.wounds.map((v) => [v.key, `${v.state}|${v.wound.dressing}|${v.wound.salved ? 1 : 0}`]));
    for (const [key, s] of states) {
      const was = this.lastWounds.get(key);
      if (was !== undefined && was !== s) this.seenAt.set(key, now);
      // A fresh wound makes the figure flinch.
      if (was === undefined && this.primed) this.flinch();
    }
    this.lastWounds = states;
    this.primed = true;
    if (this.picked && !states.has(this.picked)) this.picked = null;
    // Nothing on the screen moves unless what it says has: the rows hold their buttons still under a pointer.
    const sig = JSON.stringify([this.picked, r.wounds.map((v) => [v.key, v.state, v.title, v.tags, v.eta, v.severity.toFixed(2),
      v.cares.map((c) => [c.id, c.why, c.have, c.make, c.target ? 1 : 0])]), [...this.seenAt.entries()].filter(([, t]) => now - t < SEEN_TO).map(([k]) => k)]);
    if (sig === this.drawn) return;
    this.drawn = sig;
    this.drawFigure(r.wounds);
    if (!r.wounds.length) {
      this.list.replaceChildren(el('div', 'hp-none', 'Nothing is open on you.'));
      return;
    }
    this.list.replaceChildren(...r.wounds.map((v) => this.woundRow(v, now)));
  }

  private flinch(): void {
    this.figure.classList.remove('hp-flinch');
    void this.figure.getBoundingClientRect();
    this.figure.classList.add('hp-flinch');
  }

  private drawFigure(views: WoundView[]): void {
    const parts = new Map<string, string>();
    for (const v of views) if (!parts.has(v.wound.part)) parts.set(v.wound.part, v.state);
    for (const p of this.figure.querySelectorAll<SVGElement>('.hp-part')) {
      const st = parts.get(p.dataset.part ?? '');
      if (st) p.dataset.state = st;
      else delete p.dataset.state;
    }
    const marks: SVGGElement[] = [];
    const onPart = new Map<string, number>();
    for (const v of views) {
      const [x0, y] = PART_AT[v.wound.part] ?? [50, 64];
      const n = onPart.get(v.wound.part) ?? 0;
      onPart.set(v.wound.part, n + 1);
      const x = x0 + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 9;
      const g = svg('g', { class: `hp-mark hp-mark-${v.state}`, transform: `translate(${x} ${y})`, 'data-key': v.key, tabindex: 0, role: 'button' });
      g.setAttribute('aria-label', `${v.title} on your ${v.part}`);
      if (v.key === this.picked) g.classList.add('hp-mark-picked');
      const t = svg('title');
      t.textContent = `${v.title} on your ${v.part}`;
      g.append(t, svg('circle', { r: 7, class: 'hp-mark-ring' }), svg('circle', { r: 4.2, class: 'hp-mark-dot' }));
      if (v.state === 'bleeding' || v.state === 'bad') g.append(svg('path', { class: 'hp-drip', d: 'M0 6 C -2 9 -2 11 0 12 C 2 11 2 9 0 6 Z' }));
      if (v.state === 'dressed' || v.state === 'covered') g.append(svg('rect', { class: 'hp-wrap', x: -7, y: -2.2, width: 14, height: 4.4, rx: 2 }));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.pick(v.key);
        }
      });
      marks.push(g);
    }
    this.figureMarks.replaceChildren(...marks);
    this.figure.setAttribute('aria-label', views.length ? `Your body, with ${views.length} ${views.length === 1 ? 'wound' : 'wounds'} marked` : 'Your body, unhurt');
  }

  private woundRow(v: WoundView, now: number): HTMLElement {
    const open = v.key === this.picked;
    const box = el('div', `hp-wound hp-wound-${v.state}${open ? ' hp-wound-open' : ''}`);
    box.dataset.key = v.key;
    box.setAttribute('role', 'listitem');
    const seen = this.seenAt.get(v.key);
    if (seen !== undefined && now - seen < SEEN_TO) box.classList.add('hp-wound-seen');
    const head = el('button', 'hp-wound-head');
    head.type = 'button';
    head.setAttribute('aria-expanded', String(open));
    const dot = el('span', 'hp-wound-dot');
    const name = el('span', 'hp-wound-name');
    name.append(el('b', '', v.title), el('span', 'hp-wound-part', ` · ${v.part}`));
    const sev = el('span', 'hp-wound-sev');
    sev.title = 'How deep it is';
    const sf = el('span', 'hp-wound-sev-fill');
    sf.style.width = pct(v.severity);
    sev.append(sf);
    const tags = el('span', 'hp-wound-tags', v.tags.join(' · '));
    const eta = el('span', 'hp-wound-eta', v.eta);
    const want = v.cares.find((c) => c.why === null);
    const hint = el('span', `hp-wound-hint${want ? ' hp-wound-hint-go' : ''}`, open ? 'Close' : want ? `${want.button} it` : 'What it needs');
    head.append(dot, name, hint, sev, tags, eta);
    head.addEventListener('click', () => this.pick(v.key));
    box.append(head);
    if (open) box.append(this.careBlock(v));
    return box;
  }

  private careBlock(v: WoundView): HTMLElement {
    const block = el('div', 'hp-care');
    if (!v.cares.length) {
      block.append(el('div', 'hp-care-done', `Under the herb that suits it, nothing closes it faster and it cannot go bad. ${v.eta}`));
      return block;
    }
    for (const c of v.cares) block.append(this.careRow(c));
    return block;
  }

  private careRow(c: Care): HTMLElement {
    const row = el('div', `hp-care-row${c.why === null ? ' hp-care-ready' : ''}`);
    const head = el('div', 'hp-care-head');
    const btn = el('button', 'hp-care-btn', c.button);
    btn.type = 'button';
    btn.disabled = c.why !== null || !c.target;
    if (c.why) btn.title = c.why;
    btn.addEventListener('click', () => {
      const def = ACTION_BY_ID.get(c.id);
      if (!def || !c.target) return;
      this.game.requestAction(def, c.target, 1);
      btn.classList.add('hp-care-btn-go');
    });
    head.append(el('b', 'hp-care-title', c.title), btn);
    const need = el('div', 'hp-care-need');
    need.append(el('span', `hp-held${c.holding ? ' hp-held-ok' : ''}`, c.holding ? 'Carried' : 'Needed'), document.createTextNode(` ${c.needs}`));
    row.append(head, need, el('div', 'hp-care-have', c.have));
    if (c.make) row.append(el('div', 'hp-care-make', c.make));
    if (c.why) row.append(el('div', 'hp-care-why', c.why));
    return row;
  }

  private drawEffects(into: HTMLElement, list: Effect[], none: string): void {
    const sig = JSON.stringify(list.map((e) => [e.id, e.name, e.caption, e.does]));
    if (into.dataset.sig === sig) return;
    into.dataset.sig = sig;
    if (!list.length) {
      into.replaceChildren(el('div', 'hp-none', none));
      return;
    }
    into.replaceChildren(...list.map((e) => {
      const row = el('div', `hp-ail ${e.good ? 'hp-ail-good' : 'hp-ail-bad'}`);
      const icon = el('span', 'hp-ail-icon');
      icon.innerHTML = svgOf(e.glyph as Parameters<typeof svgOf>[0]);
      const text = el('div', 'hp-ail-text');
      const name = el('div', 'hp-ail-name');
      name.append(el('b', '', e.name));
      if (e.caption) name.append(el('span', 'hp-ail-cap', e.caption));
      text.append(name, ...e.does.map((d) => el('div', 'hp-ail-does', d)));
      row.append(icon, text);
      row.title = `Source: ${e.from}`;
      return row;
    }));
  }

  private drawFood(r: HealthReport): void {
    this.fedWord.textContent = r.fed;
    const sig = r.nutrition.map((n) => n.value.toFixed(2)).join() + r.nutritionWords.join();
    if (this.food.dataset.sig === sig) return;
    this.food.dataset.sig = sig;
    this.food.replaceChildren(...r.nutrition.map((n) => {
      const row = el('div', `hp-nut hp-nut-${n.id}`);
      const track = el('span', 'hp-nut-track');
      const fill = el('span', 'hp-nut-fill');
      fill.style.width = pct(n.value);
      track.append(fill);
      row.append(el('span', 'hp-nut-name', n.name), track, el('span', 'hp-nut-num', pct(n.value)), el('span', 'hp-nut-note', n.note));
      return row;
    }));
    this.foodWords.replaceChildren(...r.nutritionWords.map((w) => el('div', '', w)));
  }
}
