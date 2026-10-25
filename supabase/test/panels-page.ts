/**
 * The page `scripts/boot-check.mjs` opens under the built game page's own
 * Content-Security-Policy and Trusted Types (its head, as built): the game as
 * the island runs it once you are in, the renderer and the windows, every
 * window opened, every journal tab shown, the help built, and lines of chat in
 * the log that are markup and links. The boot check fails on any policy
 * violation, any throw, and any of `HostileSeen` that is not as it should be.
 *
 * Bundled for the browser by the boot check, which reads `window.panels` once
 * `done` is set.
 */
import '../../src/page-guard';
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import type { JournalTab } from '../../src/ui/panels/journal';
import { html, setMarkup } from '../../src/ui/html';

/** Chat, notes, signs and names that are markup or links, which must reach the screen as the text they are. */
export const HOSTILE = [
  '<img src="x" onerror="window.__pwned = 1">',
  '<a href="javascript:window.__pwned = 1">here</a>',
  '<svg onload="window.__pwned = 1"></svg>',
  '<style>#ui { display: none }</style>',
  'see https://example.com/a?b=<b>c</b> and javascript:alert(1) and data:text/html,<script>1</script>',
];

export interface HostileSeen {
  /** Windows opened, by id. */
  opened: string[];
  /** Journal tabs shown. */
  tabs: string[];
  /** Whether the help was built into its tab. */
  help: boolean;
  /** Each hostile line, whether the log shows it as its own text. */
  shown: boolean[];
  /** Elements in the UI made from that text: an img, an svg with onload, a style, any on* attribute. */
  made: string[];
  /** Links in the UI whose address is neither this site nor https:, or that open a new tab without rel="noopener noreferrer". */
  badLinks: string[];
  /** Links in the event log at all: chat is never linkified. */
  logLinks: number;
  /** Whether a markup-in-`html` check put the text in as text. */
  escaped: boolean;
  /** Whether anything set `window.__pwned`. */
  pwned: boolean;
  done: boolean;
}

const seen: HostileSeen = { opened: [], tabs: [], help: false, shown: [], made: [], badLinks: [], logLinks: 0, escaped: false, pwned: false, done: false };
(window as unknown as { panels: HostileSeen }).panels = seen;

document.getElementById('boot')?.remove();
const canvasEl = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const game = Game.create(4242, 128);
const day0 = 1000 * DAY_SECONDS;
game.islandClock = () => day0 + (13 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.putBody(game.spawn.x + 0.5, game.spawn.y + 0.5, 0);

const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });

const frame = (): void => {
  game.update(1 / 60);
  renderer.camera.focus(game.spawn.x, game.spawn.y, game.playerHeight(), null);
  renderer.render(1 / 60);
  ui.update(60);
};
const rest = (ms: number): Promise<void> => new Promise((done) => window.setTimeout(done, ms));

for (const text of HOSTILE) game.events.emit('log', { time: Date.now(), text, kind: 'chat' });
frame();

for (const [id, win] of ui.windows.windows) {
  if (!win.isOpen) win.open();
  frame();
  seen.opened.push(id);
}
const TABS: JournalTab[] = ['goals', 'ledger', 'news', 'boards', 'guide', 'tracker', 'help'];
for (const tab of TABS) {
  ui.toggleJournal(tab);
  frame();
  seen.tabs.push(tab);
}
for (let i = 0; i < 100 && !uiRoot.querySelector('.help-sec'); i++) await rest(50);
seen.help = !!uiRoot.querySelector('.help-sec');
ui.openPalette();
frame();
ui.showEmotes();
frame();
await rest(200);
frame();

const log = uiRoot.querySelector('.log-list');
const logText = log?.textContent ?? '';
seen.shown = HOSTILE.map((t) => logText.includes(t));
seen.logLinks = log?.querySelectorAll('a').length ?? 0;
for (const e of uiRoot.querySelectorAll('img[src="x"], svg[onload], style')) seen.made.push(e.outerHTML.slice(0, 80));
for (const e of uiRoot.querySelectorAll('*')) {
  for (const a of e.getAttributeNames()) if (/^on/i.test(a)) seen.made.push(`${e.tagName.toLowerCase()} ${a}`);
}
for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
  const url = new URL(a.href, location.href);
  const ours = url.origin === location.origin;
  const rel = (a.rel || '').split(/\s+/);
  if (!ours && url.protocol !== 'https:') seen.badLinks.push(a.href);
  else if (a.target === '_blank' && !(rel.includes('noopener') && rel.includes('noreferrer'))) seen.badLinks.push(`${a.href} (target=_blank without rel="noopener noreferrer")`);
}

const probe = document.createElement('div');
setMarkup(probe, html`<b>${HOSTILE[0]}</b>`);
seen.escaped = probe.childNodes.length === 1 && probe.firstElementChild?.tagName === 'B' && probe.textContent === HOSTILE[0];
seen.pwned = (window as unknown as { __pwned?: unknown }).__pwned !== undefined;
seen.done = true;
