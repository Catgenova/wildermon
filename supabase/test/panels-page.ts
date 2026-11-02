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
import { RESPAWN_ARM_MS, showRespawn } from '../../src/ui/respawn';
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
  /** The UI Menu's rows, label and key, and the journal tab its Journal: Field guide row turned to. */
  /** How long turning to the field guide held the page, in ms: the longest single call. */
  guideMs: number;
  /** In the 8 s after the field guide opens: frames drawn, the longest gap between two (ms), and gaps over 250 ms. */
  guideLong: [number, number, number];
  /** The respawn chooser: picked by an Enter at once or a held one (should not be), and by a click after (should be). */
  respawn: { atOnce: string; held: string; later: string };
  menu: Array<[string, string]>;
  menuTab: string;
  /** The map: tiles a click at the picture's corners landed on against the tiles shown there, and what the wheel, a drag and Fit did. */
  map: { corner: number; zoomed: boolean; panned: boolean; fit: boolean; error: string };
  /** Whether a markup-in-`html` check put the text in as text. */
  escaped: boolean;
  /** Whether anything set `window.__pwned`. */
  pwned: boolean;
  done: boolean;
}

const seen: HostileSeen = { opened: [], tabs: [], help: false, shown: [], made: [], badLinks: [], logLinks: 0, escaped: false, pwned: false, done: false, guideMs: -1, guideLong: [0, 0, 0], menu: [], menuTab: '', respawn: { atOnce: '', held: '', later: '' }, map: { corner: -1, zoomed: false, panned: false, fit: false, error: '' } };
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
  const t0 = performance.now();
  ui.toggleJournal(tab);
  frame();
  if (tab === 'guide') seen.guideMs = performance.now() - t0;
  if (tab === 'guide') {
    // What a player sees as a freeze: the longest gap between two frames the page got to draw, the world not drawn meanwhile.
    const gaps: number[] = [];
    let last = performance.now();
    let on = true;
    const tick = (): void => {
      const now = performance.now();
      gaps.push(now - last);
      last = now;
      if (on) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    await rest(8000);
    on = false;
    seen.guideLong = [gaps.length, Math.round(Math.max(0, ...gaps)), gaps.filter((g) => g > 250).length];
  }
  seen.tabs.push(tab);
}
for (let i = 0; i < 100 && !uiRoot.querySelector('.help-sec'); i++) await rest(50);
seen.help = !!uiRoot.querySelector('.help-sec');
// The map: a click lands on the tile under it in a window taller than it is wide, the wheel zooms, a drag pans, Fit lets go.
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mm = (ui as any).minimap;
  const view = uiRoot.querySelector<HTMLCanvasElement>('canvas.minimap')!;
  const fitBtn = [...uiRoot.querySelectorAll<HTMLButtonElement>('.map-bar button')].find((b) => b.textContent === 'Fit')!;
  const mapWin = view.closest<HTMLElement>('.win')!;
  mapWin.style.width = '260px';
  mapWin.style.height = '520px';
  ui.update(60);
  frame();
  mm.lastDraw = -1e9;
  mm.update();
  const r = view.getBoundingClientRect();
  const size = Math.min(r.width, r.height);
  const left = r.left + (r.width - size) / 2, top = r.top + (r.height - size) / 2;
  const cam = renderer.camera;
  const was = cam.focus.bind(cam);
  let got: [number, number] = [NaN, NaN];
  cam.focus = (x: number, y: number, h: number, dt: number | null) => { got = [x, y]; was(x, y, h, dt); };
  const win0 = { ...mm.win };
  const err: number[] = [];
  for (const [fx, fy] of [[0.05, 0.05], [0.95, 0.95], [0.05, 0.95]]) {
    view.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: left + fx * size, clientY: top + fy * size }));
    err.push(Math.hypot(got[0] - (win0.x + fx * win0.span), got[1] - (win0.y + fy * win0.span)));
  }
  seen.map.corner = Math.max(...err);
  view.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: left + size / 2, clientY: top + size / 2, deltaY: -300 }));
  seen.map.zoomed = mm.win.span < win0.span && !fitBtn.disabled;
  const before = { ...mm.win };
  const id = 7;
  view.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: id, button: 0, pointerType: 'mouse', clientX: left + size / 2, clientY: top + size / 2 }));
  view.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: id, pointerType: 'mouse', clientX: left + size / 2 - 40, clientY: top + size / 2 - 40 }));
  view.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: id, pointerType: 'mouse', clientX: left + size / 2 - 40, clientY: top + size / 2 - 40 }));
  seen.map.panned = mm.win.x > before.x && mm.win.y > before.y;
  fitBtn.click();
  seen.map.fit = fitBtn.disabled && mm.win.span === win0.span && mm.win.x === win0.x && mm.win.y === win0.y;
  cam.focus = was;
} catch (e) {
  seen.map.error = String(e);
}

// The chooser after a death: nothing picked by a key down at once or held from the fight; a click after the pause picks.
{
  const fell = { x: 40, y: 40, deeds: [] };
  const shown = showRespawn(uiRoot, fell, game.world.w, { x: 10.5, y: 10.5 });
  let picked = '';
  void shown.done.then((at) => { picked = at; });
  const first = shown.el.querySelector<HTMLButtonElement>('button')!;
  first.focus();
  shown.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  first.click();
  await rest(0);
  seen.respawn.atOnce = picked || 'nothing';
  await rest(RESPAWN_ARM_MS + 100);
  const held = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true });
  first.dispatchEvent(held);
  await rest(0);
  seen.respawn.held = picked || (held.defaultPrevented ? 'nothing' : 'not stopped');
  first.click();
  await rest(0);
  seen.respawn.later = picked || 'nothing';
  shown.close();
}

// The UI Menu: every window, the journal's tabs and Settings: Keys, each with its key.
ui.showWindowMenu(10, 10);
frame();
for (const row of uiRoot.querySelectorAll<HTMLElement>('.ctx-item')) {
  seen.menu.push([row.querySelector('.ctx-label')?.textContent ?? '', row.querySelector('.ctx-shortcut')?.textContent ?? '']);
}
[...uiRoot.querySelectorAll<HTMLElement>('.ctx-item')].find((r) => r.querySelector('.ctx-label')?.textContent === 'Journal: Field guide')?.click();
frame();
seen.menuTab = uiRoot.querySelector('.journal-tabs .tb-on')?.textContent ?? '';
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
