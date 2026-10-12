import { GLYPHS } from '../render/runestone';
import type { Settings, UiFrames, UiLight, UiStyle } from '../game/settings';

/**
 * The interface's look: Runecut or Classic, and Runecut's stone by day or
 * after dark.
 *
 * Everything that changes is in `src/style.css`, keyed on two attributes on
 * <html>: `data-ui` (`runecut` or `classic`) and `data-rc` (`day` or `night`).
 * This only decides which, so a look is one attribute write and the browser's
 * own restyle rather than anything walking the windows.
 */

/** What the attributes were last set to, so a frame that changes nothing writes nothing. */
let shown = '';

/** The look as it is now: Runecut or Classic, which stone, and whether the windows' borders are their own materials or plain stone. */
export interface Look {
  ui: UiStyle;
  rc: 'day' | 'night';
  frames: UiFrames;
}

let current: Look | null = null;
const watchers: Array<(look: Look) => void> = [];

/** Be told whenever the look changes, and at once of the look as it is if it has been set. The windows' stone and frames are repainted off this (`src/ui/runecut-dress.ts`). */
export function watchLook(fn: (look: Look) => void): void {
  watchers.push(fn);
  if (current) fn(current);
}

/** An hour of the island's day as its clock writes it: 20.9 is "20:54". */
export function islandTime(h: number): string {
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Which stone Runecut shows for a setting: by day, after dark, or as the island's clock says (`Game.isNight`). */
export function lightFor(light: UiLight, night: boolean): 'day' | 'night' {
  return light === 'clock' ? (night ? 'night' : 'day') : light;
}

/**
 * Put the look the settings ask for on the page. Cheap enough to call every
 * frame, which is how `clock` follows the island across dusk and dawn.
 */
export function applyLook(settings: Pick<Settings, 'uiStyle' | 'uiLight' | 'uiFrames'>, night: boolean): void {
  const ui: UiStyle = settings.uiStyle;
  const rc = lightFor(settings.uiLight, night);
  const key = `${ui}/${rc}/${settings.uiFrames}`;
  if (key === shown) return;
  shown = key;
  const root = document.documentElement;
  root.dataset.ui = ui;
  root.dataset.rc = rc;
  current = { ui, rc, frames: settings.uiFrames };
  for (const fn of watchers) fn(current);
}

/**
 * The rune cut at the head of each window, from the stones' own set
 * (`GLYPHS` in src/render/runestone.ts), so a window and the stone it is named
 * for carry the same mark. Any window not named here gets the six-pointed star.
 */
export const WINDOW_RUNES: Record<string, string> = {
  inventory: 'othala',
  look: 'algiz',
  skills: 'tiwaz',
  craft: 'harrow',
  map: 'star8',
  hoard: 'star8',
  events: 'laguz',
  market: 'diamondDot',
  settings: 'key',
  help: 'eye',
  crate: 'diamond',
  stores: 'diamond',
  faith: 'crescent',
  trades: 'crescent',
};

export const runeFor = (windowId: string): string => WINDOW_RUNES[windowId] ?? 'star6';

const SVG_NS = 'http://www.w3.org/2000/svg';
const num = (v: number): string => String(Math.round(v * 1000) / 1000);

/**
 * A glyph's strokes as an SVG path. The stones' unit box has y up, as the
 * face it is cut into does; SVG has y down, so each y is turned over.
 */
export function runePath(name: string): string {
  const strokes = GLYPHS[name] ?? GLYPHS.star6;
  return strokes
    .map((st) => st.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${num(x)} ${num(-y)}`).join(' ') + (st.closed ? ' Z' : ''))
    .join(' ');
}

/**
 * A rune as an inline SVG, as the stones show one: the groove cut into the
 * face, and the light lying in it, a narrower line down its middle. The CSS
 * colours the two (`.rc-rune-groove`, `.rc-rune-light`), so day, night and
 * the front window's breathing are all the stylesheet's to say.
 */
export function runeSvg(name: string, className = 'rc-rune'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-1.35 -1.35 2.7 2.7');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  svg.dataset.rune = name;
  const d = runePath(name);
  for (const part of ['groove', 'light'] as const) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', `rc-rune-${part}`);
    svg.append(p);
  }
  return svg;
}
