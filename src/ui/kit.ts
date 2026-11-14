/**
 * The interior kit's builders (src/ui/interior.css): what a window is made of
 * inside its rim, made one way.
 *
 * Every builder puts the kit's class beside the class the element already
 * wears (`also`, `inv-row` beside `rc-row`): Runecut draws the kit's, and
 * Classic, which has no rules for the kit, keeps drawing the element's own,
 * so Classic is unchanged by a window moving onto the kit.
 */

/** The kit's class names. */
export const KIT = {
  body: 'rc-body',
  scroll: 'rc-scroll',
  bar: 'rc-bar',
  foot: 'rc-foot',
  row: 'rc-row',
  colhead: 'rc-colhead',
  section: 'rc-section',
  btn: 'rc-btn',
  on: 'rc-on',
  now: 'rc-now',
  go: 'rc-go',
  danger: 'rc-danger',
  icon: 'rc-icon',
  tabs: 'rc-tabs',
  tab: 'rc-tab',
  field: 'rc-field',
  search: 'rc-search',
  check: 'rc-check',
  table: 'rc-table',
  empty: 'rc-empty',
  badge: 'rc-badge',
  tag: 'rc-tag',
  card: 'rc-card',
  sunk: 'rc-sunk',
  meter: 'rc-meter',
  fill: 'rc-meter-fill',
  mark: 'rc-meter-mark',
} as const;

export type KitPart = keyof typeof KIT;

/** What a status line, a tag or a meter says by its colour (and a meter by its stripes too). */
export type Meaning = 'good' | 'warn' | 'bad' | 'info' | 'accent';

/** Put the kit's part on an element that is already made, beside what it wears. */
export function kit<E extends Element>(el: E, ...parts: KitPart[]): E {
  el.classList.add(...parts.map((p) => KIT[p]));
  return el;
}

/** A new element wearing a kit part and its own classes (`also`, space-separated). */
export function made<K extends keyof HTMLElementTagNameMap>(tag: K, part: KitPart, also = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = also ? `${also} ${KIT[part]}` : KIT[part];
  return el;
}

/** Say what a status line, a tag, a card or a meter means; null says nothing. */
export function meaning<E extends HTMLElement>(el: E, m: Meaning | null): E {
  if (m) el.dataset.meaning = m;
  else delete el.dataset.meaning;
  return el;
}

/** A window's body on the kit: the one padding inside the rim, nothing of its own that scrolls. */
export function kitBody(body: HTMLElement, ...also: string[]): void {
  body.classList.add(...also, KIT.body);
}

export interface ButtonOpts {
  /** Go: the window's one main press. Danger: it cannot be taken back. Icon: a square with a glyph. */
  kind?: 'go' | 'danger' | 'icon';
  title?: string;
  /** Its own classes; a toolbar's small button (`tb-btn tb-small`) unless said. */
  also?: string;
  onClick?: (e: MouseEvent) => void;
}

/** A button. */
export function kitButton(label: string, opts: ButtonOpts = {}): HTMLButtonElement {
  const b = made('button', 'btn', opts.also ?? 'tb-btn tb-small');
  b.type = 'button';
  b.textContent = label;
  if (opts.kind) b.classList.add(KIT[opts.kind]);
  if (opts.title) b.title = opts.title;
  if (opts.onClick) b.addEventListener('click', opts.onClick);
  return b;
}

/** A button that stays in or out: on, and pressed for a screen reader. */
export function kitPressed(b: HTMLElement, on: boolean): void {
  b.classList.toggle('tb-on', on);
  b.classList.toggle(KIT.on, on);
  b.setAttribute('aria-pressed', String(on));
}

/** A search box: the field, in a wrapper that carries the kit's one glass. */
export function kitSearch(placeholder: string, also = 'panel-search'): { el: HTMLSpanElement; input: HTMLInputElement } {
  const el = made('span', 'search');
  const input = made('input', 'field', also);
  input.type = 'search';
  input.placeholder = placeholder;
  el.append(input);
  return { el, input };
}

/** What a list says when there is nothing in it. */
export function kitEmpty(text: string, also = 'inv-empty'): HTMLDivElement {
  const el = made('div', 'empty', also);
  el.textContent = text;
  return el;
}

/** A section's name in a list. */
export function kitSection(text: string, also = 'inv-group'): HTMLDivElement {
  const el = made('div', 'section', also);
  el.textContent = text;
  return el;
}

/** A badge: a count, or a word. */
export function kitBadge(text: string, kind: 'count' | 'tag', also = '', m: Meaning | null = null): HTMLSpanElement {
  const el = made('span', kind === 'count' ? 'badge' : 'tag', also);
  el.textContent = text;
  if (kind === 'tag') meaning(el, m);
  return el;
}

/** At or under this a meter of something it is good to have more of is bad; under `METER_WARN`, warn. */
export const METER_BAD = 0.2;
export const METER_WARN = 0.5;

/** What a fraction says by its colour, for a meter of something it is good to have more of. */
export function fullness(frac: number): Meaning {
  return frac <= METER_BAD ? 'bad' : frac < METER_WARN ? 'warn' : 'good';
}

/** A meter: a channel and its fill, with marks where something starts; `set` fills it to a fraction, by what it means. */
export function kitMeter(also = '', fillAlso = '', marks: Array<{ at: number; also?: string }> = []): { el: HTMLDivElement; fill: HTMLDivElement; set: (frac: number, m: Meaning) => void } {
  const el = made('div', 'meter', also);
  const fill = made('div', 'fill', fillAlso);
  el.append(fill);
  for (const m of marks) {
    const mark = made('div', 'mark', m.also ?? '');
    mark.style.left = `${(m.at * 100).toFixed(2)}%`;
    el.append(mark);
  }
  return {
    el,
    fill,
    set: (frac, m) => {
      fill.style.width = `${(Math.max(0, Math.min(1, frac)) * 100).toFixed(1)}%`;
      meaning(el, m);
    },
  };
}

/** A row of tabs, and a tab in it; `kitTabOn` marks the open one. */
export function kitTabs(also = ''): HTMLDivElement {
  const el = made('div', 'tabs', also);
  el.setAttribute('role', 'tablist');
  return el;
}

export function kitTab(label: string, also = ''): HTMLButtonElement {
  const b = made('button', 'tab', also);
  b.type = 'button';
  b.setAttribute('role', 'tab');
  b.textContent = label;
  return b;
}

export function kitTabOn(b: HTMLElement, on: boolean): void {
  b.classList.toggle('tb-on', on);
  b.classList.toggle(KIT.on, on);
  b.setAttribute('aria-selected', String(on));
}

/** A checkbox, in its label. */
export function kitCheck(label: string, also = ''): { el: HTMLLabelElement; input: HTMLInputElement } {
  const el = document.createElement('label');
  if (also) el.className = also;
  const input = made('input', 'check');
  input.type = 'checkbox';
  el.append(input, document.createTextNode(` ${label}`));
  return { el, input };
}
