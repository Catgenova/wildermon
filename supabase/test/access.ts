/**
 * Settings for the person at the screen: the low-end graphics, less motion,
 * the text size presets and the keys.
 *
 * Drawn in Chromium, on the page `access-page.ts` builds: a wood of solid oaks
 * and rose bushes round you, with the windows up.
 *
 *   * Low-end graphics (and Low power on a phone) draw every tree and bush
 *     flat: none of them as a solid; Full and Fast draw them solid. Low-end
 *     keeps to `LOW_POWER_FPS` and one pixel to the point, as Low power does.
 *   * Less motion -- chosen, or the system's prefers-reduced-motion while the
 *     setting follows it -- stops the solid trees' sway on every frame, puts
 *     `data-motion="less"` on the page, and leaves a 2 s transition at
 *     next to nothing; Full motion sways them.
 *   * A Text size preset puts its size on: asked for, shown, and the
 *     interface scaled by it.
 *   * Every row of the Keys tab takes a new key through its slot and goes back
 *     to its own with its ↺; no key is under two things out of the box; a
 *     table kept with U under both the Market and the Stores leaves U with the
 *     Stores and gives the Market its own; every key handled in `main.ts` is a
 *     row of the table, and the handler matches no key by name but the Ctrl+K
 *     alias and the browser's own (Tab, /, F-keys).
 *
 * The clock is the page's own, moved a thirtieth of a second a frame. Needs a
 * Chromium: the one in `CHROME_PATH`, Playwright's, or an installed Chrome.
 * With none it says so and passes, unless `CROWD_STRICT` is set, as it is in CI.
 */
import { build } from 'esbuild';
import { chromium, type BrowserContextOptions, type LaunchOptions } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Access, Rules } from './access-page';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/** A Chromium to drive, as `scripts/boot-check.mjs` finds one, or null. */
function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}

// ---- The source: every key main.ts handles is a row of the table, and no key is matched by name past the table. ----
const main = readFileSync(resolve('src/main.ts'), 'utf8');
const pressBlock = /const PRESSES: Record<string, \(\) => void> = \{([\s\S]*?)\n\};/.exec(main)?.[1] ?? '';
const presses = [...pressBlock.matchAll(/^ {2}([a-z_0-9]+): /gm)].map((m) => m[1]);
const onKey = /input\.onKey = \(code, ev\) => \{([\s\S]*?)\n\};/.exec(main)?.[1] ?? '';
const named = [...onKey.matchAll(/code === '([A-Za-z0-9]+)'/g)].map((m) => m[1]);
/** Ctrl+K is an alias for Find anything, which has its own row; Tab, Slash and the F-keys are only kept from the browser. */
const ALIASES = new Set(['KeyK', 'Tab', 'Slash']);
check('the key handler in main.ts was found, and the presses in it', presses.length > 20 && onKey.length > 100, `${presses.length} presses`);
check('the key handler matches no key by name past the table (Ctrl+K and the browser\'s own aside)',
  named.every((c) => ALIASES.has(c)), named.filter((c) => !ALIASES.has(c)).join(', ') || 'none');

const options = browserOptions();
if (!options) {
  console.log('access: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  for (const line of [...ok, ...bad]) console.log(line);
  process.exit(process.env.CROWD_STRICT || bad.length ? 1 : 0);
}

const bundled = await build({
  entryPoints: [resolve('supabase/test/access-page.ts')],
  bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});
const page = bundled.outputFiles[0].text;
const css = readFileSync(resolve('src/style.css'), 'utf8');

const browser = await chromium.launch(options!);
try {
  const open = async (more: BrowserContextOptions = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, ...more });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addStyleTag({ content: css });
    await tab.addScriptTag({ content: `(() => {
      let t = performance.now();
      const d0 = Date.now() - t;
      performance.now = () => t;
      Date.now = () => d0 + t;
      window.driven = { tick: (ms) => { t += ms; } };
    })();` });
    await tab.addScriptTag({ content: page });
    if (thrown.length) throw new Error(`the page threw: ${thrown.join('; ')}`);
    return { tab, ctx, thrown };
  };
  type Tab = Awaited<ReturnType<typeof open>>['tab'];
  const call = <K extends keyof Access>(tab: Tab, name: K, ...args: unknown[]): Promise<ReturnType<Extract<Access[K], (...a: never[]) => unknown>>> =>
    tab.evaluate(([name, args]) => {
      const fn = (window as unknown as { access: Record<string, (...a: unknown[]) => unknown> }).access[name as string];
      return fn(...(args as unknown[]));
    }, [name, args] as const) as never;

  {
    const { tab, ctx, thrown } = await open({ reducedMotion: 'no-preference' });
    // Full: the solid trees and bushes drawn as solids, swaying.
    const full = await call(tab, 'draw', 90, 'full', 'full');
    check('Full graphics: trees and bushes drawn, as solids', full.all > 20 && full.solid > 20, `${full.solid} of ${full.all} solid`);
    check('Full motion: the solid trees sway', full.swayed > 0 && full.motion === 'full', `swayed on ${full.swayed} of 90 frames, data-motion ${full.motion}`);
    const fast = await call(tab, 'draw', 30, 'fast', 'full');
    check('Fast graphics: still solid', fast.solid > 20, `${fast.solid} of ${fast.all} solid`);
    const low = await call(tab, 'draw', 30, 'low', 'full');
    check('Low-end graphics: every tree and bush drawn flat', low.all > 20 && low.solid === 0, `${low.solid} of ${low.all} solid`);
    const back = await call(tab, 'draw', 30, 'full', 'full');
    check('and back to Full: solid again', back.solid > 20, `${back.solid} of ${back.all} solid`);
    // Less motion, chosen.
    const less = await call(tab, 'draw', 90, 'full', 'less');
    check('Motion Reduced: no sway on any frame', less.swayed === 0 && less.solid > 20, `swayed on ${less.swayed} of 90 frames; ${less.solid} solid`);
    check('Motion Reduced: data-motion="less" on the page', less.motion === 'less', less.motion);
    const t = await call(tab, 'transition');
    check('Motion Reduced: a 2 s transition is over at once', parseFloat(t) < 0.001, t);
    const sys = await call(tab, 'draw', 30, 'full', 'auto');
    check('Motion System, with the system asking for no less: sways', sys.swayed > 0 && sys.motion === 'full', `swayed on ${sys.swayed} of 30 frames, data-motion ${sys.motion}`);
    const tFull = await call(tab, 'transition');
    check('and the 2 s transition is left alone', tFull === '2s', tFull);

    // Text size presets.
    const at1 = await call(tab, 'preset', 1);
    const at125 = await call(tab, 'preset', 1.25);
    check('Text size preset Large: 125% asked and shown', Math.abs(at125.asked - 1.25) < 1e-9 && Math.abs(at125.shown - 1.25) < 0.01, `asked ${at125.asked}, shown ${at125.shown.toFixed(3)}`);
    check('and the interface scaled by it', Math.abs(at125.scale / at1.scale - 1.25) < 0.01, `scale ${at1.scale.toFixed(3)} → ${at125.scale.toFixed(3)}`);
    check('and a window title drawn bigger by it', at1.title > 0 && Math.abs(at125.title / at1.title - 1.25) < 0.05, `${at1.title.toFixed(1)} → ${at125.title.toFixed(1)} px`);
    const at90 = await call(tab, 'preset', 0.9);
    check('Text size preset Small: 90%', Math.abs(at90.shown - 0.9) < 0.01 && Math.abs(at90.scale / at1.scale - 0.9) < 0.01, `shown ${at90.shown.toFixed(3)}, scale ${at90.scale.toFixed(3)}`);
    await call(tab, 'preset', 1);

    // Every key remappable through its row, and back.
    const keys = await call(tab, 'rebindAll');
    check('every binding has a row in Settings, Keys', keys.listed.length === 0, keys.listed.join(', ') || `${keys.rows} rows`);
    check('every row takes a new key through its slot', keys.unbound.length === 0, keys.unbound.join(', ') || 'all took F10');
    check('every changed row shows ↺', keys.restoreHidden.length === 0, keys.restoreHidden.join(', ') || 'all shown');
    check('every row goes back to its own keys with ↺', keys.unrestored.length === 0, keys.unrestored.join(', ') || 'all restored');

    const rules = await tab.evaluate(() => (window as unknown as { rules: () => Rules }).rules());
    check('no key is under two things out of the box', rules.shared.length === 0, rules.shared.join('; ') || 'none');
    check('a table kept with U under Market and Stores: U stays with the Stores', rules.stores[0] === 'KeyU', rules.stores.join(' '));
    check('and the Market takes its own key', rules.market.length > 0 && !rules.market.includes('KeyU'), rules.market.join(' ') || 'none');
    const unknown = presses.filter((p) => !rules.ids.includes(p));
    check('every key main.ts presses is a row of the table', unknown.length === 0, unknown.join(', ') || `${presses.length} presses`);
    const reach = rules.ids.filter((id) => !presses.includes(id) && !id.startsWith('win_') && !/^layout_\d+$/.test(id) && !id.startsWith('pan_'));
    check('every row of the table does something: a press, a window, a layout or a pan', reach.length === 0, reach.join(', ') || 'all');
    for (const p of rules.presets) {
      const label = `${p.graphics}${p.phone ? ', phone with Low power' : ''}`;
      if (p.graphics === 'low' || p.lowPower) {
        check(`${label}: low-end, fast, ${p.cap}/s, ${p.dpr} pixel per point`, p.low && p.fast && p.cap === 30 && p.dpr === 1);
      } else if (p.graphics === 'fast') {
        check(`${label}: fast, not low-end, no frame limit, ${p.dpr} pixel per point`, p.fast && !p.low && p.cap === 0 && p.dpr === 1);
      } else {
        check(`${label}: neither, no frame limit, ${p.dpr} pixels per point`, !p.fast && !p.low && p.cap === 0 && p.dpr === 2);
      }
    }
    check('nothing thrown', thrown.length === 0, thrown.join('; '));
    await ctx.close();
  }
  {
    // The system asks for less motion, and the setting follows it.
    const { tab, ctx } = await open({ reducedMotion: 'reduce' });
    const sys = await call(tab, 'draw', 60, 'full', 'auto');
    check('Motion System, with prefers-reduced-motion: no sway, data-motion="less"', sys.swayed === 0 && sys.motion === 'less' && sys.solid > 20, `swayed on ${sys.swayed} of 60 frames, data-motion ${sys.motion}`);
    const full = await call(tab, 'draw', 60, 'full', 'full');
    check('and Motion Full over it: sways', full.swayed > 0 && full.motion === 'full', `swayed on ${full.swayed} of 60 frames`);
    await ctx.close();
  }
  {
    // A phone with Low power on: the low-end graphics, trees flat.
    const { tab, ctx } = await open({ viewport: { width: 400, height: 800 }, isMobile: true, hasTouch: true });
    const lp = await call(tab, 'draw', 30, 'full', 'full', true);
    check('phone, Low power: every tree and bush flat', lp.all > 5 && lp.solid === 0, `${lp.solid} of ${lp.all} solid`);
    const on = await call(tab, 'draw', 30, 'full', 'full', false);
    check('phone, Low power off, Full: solid', on.solid > 5, `${on.solid} of ${on.all} solid`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\naccess: ${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
