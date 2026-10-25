/**
 * HTML in the page: the one place it is written.
 *
 * `setMarkup` is the only code in src/ that assigns `innerHTML` (and no code
 * assigns `outerHTML` or calls `insertAdjacentHTML`); `scripts/html-sinks.mjs`
 * fails on any other. It takes `Markup`, not a string, and there are two ways
 * to have Markup:
 *
 *   * `html` as a template tag. Every `${…}` in it is escaped (`esc()`) unless
 *     it is Markup already, or an array of it — so a player's name, a line of
 *     chat, a sign or a stored key binding put in one is shown as text.
 *   * `fixed(text)`, HTML written in this source: a string literal or a
 *     constant table. Each call is on the reviewed list in
 *     `scripts/html-sinks.allow`, and none may interpolate anything but `esc()`
 *     or a constant.
 *
 * The page's Trusted Types policy (`src/page-guard.ts`) takes HTML from here
 * and nowhere else.
 */
import { esc } from './esc';
import { vouch } from '../page-guard';

declare const MARKUP: unique symbol;
/** HTML this source wrote, with anything from outside it escaped. */
export interface Markup {
  readonly html: string;
  readonly [MARKUP]: true;
}

const made = new WeakSet<object>();
const mark = (text: string): Markup => {
  const m = Object.freeze({ html: text }) as Markup;
  made.add(m);
  return m;
};

/** Whether `v` was made here, by `html` or `fixed`. */
export const isMarkup = (v: unknown): v is Markup => typeof v === 'object' && v !== null && made.has(v);

const piece = (v: unknown): string => (Array.isArray(v) ? v.map(piece).join('') : isMarkup(v) ? v.html : esc(v));

/** A template of HTML: its literal parts as written, every `${…}` escaped unless it is Markup (or an array of it). */
export function html(parts: TemplateStringsArray, ...values: unknown[]): Markup {
  let text = parts[0];
  for (let i = 0; i < values.length; i++) text += piece(values[i]) + parts[i + 1];
  return mark(text);
}

/** HTML written in this source, taken as it stands. Reviewed: every call is in `scripts/html-sinks.allow`. */
export const fixed = (text: string): Markup => mark(text);

/** A table of HTML constants (pictures), each taken as it stands. */
export const fixedAll = <K extends string>(table: Record<K, string>): Record<K, Markup> =>
  Object.fromEntries(Object.entries(table).map(([k, v]) => [k, mark(v as string)])) as Record<K, Markup>;

/** Nothing. */
export const NO_MARKUP: Markup = mark('');

/** Replace what `el` holds with `m`. */
export function setMarkup(el: Element, m: Markup): void {
  el.innerHTML = vouch(m.html);
}
