/**
 * The level, shown while set.
 *
 * Asked for: "a potential helper would be adding a visual somewhere on screen
 * if you currently have a level set". In a game run as the island runs it,
 * with the interface and the renderer over it (`levelmark-page.ts`), in
 * Chromium:
 *
 *   * no level, no chip;
 *   * the island's level coming in with a ground read shows the chip at once,
 *     "Level 4.0 m", before any hud tick;
 *   * on the ground, with a level set: a corner above it drawn amber, one
 *     below it blue, one at it green;
 *   * Set level here asked at a corner, and the island's level coming back at
 *     that corner's height: the chip names the corner;
 *   * × on the chip asks the island for Clear level, as its menu entry does;
 *   * the island's level cleared hides the chip and the marks.
 *
 * Needs a Chromium as `trailwater.ts` does; without one nothing is drawn,
 * unless `LEVELMARK_STRICT` is set, as it is in CI. Needs no database.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from './pagebuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import type { Chip, LevelPage } from './levelmark-page';
import { bad, check, finish } from './harness';

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

type RGB = [number, number, number];
const say = (c: RGB): string => c.map((v) => v.toFixed(0)).join(',');
/** Amber: red gone well further over blue than on the bare ground. Blue: blue gone well over red. Green: green over both. */
const amber = (c: RGB, bare: RGB): boolean => (c[0] - c[2]) - (bare[0] - bare[2]) > 50;
const blue = (c: RGB, bare: RGB): boolean => (c[2] - c[0]) - (bare[2] - bare[0]) > 50 && c[2] > c[0];
const green = (c: RGB): boolean => c[1] - c[0] > 30 && c[1] - c[2] > 30;

const options = browserOptions();
if (!options) {
  console.log('levelmark: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.LEVELMARK_STRICT) bad.push('FAIL drawn: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/levelmark-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    type Lm = { levelmark: LevelPage };
    const chip = (): Promise<Chip> => tab.evaluate(() => (window as unknown as Lm).levelmark.chip());
    const colour = (at: [number, number]): Promise<RGB> => tab.evaluate((a) => (window as unknown as Lm).levelmark.colour(a[0], a[1]), at);
    const saw = (level: number | null): Promise<void> => tab.evaluate((l) => (window as unknown as Lm).levelmark.saw(l), level);
    const asked = (): Promise<Array<{ id: string; cx?: number; cy?: number }>> => tab.evaluate(() => (window as unknown as Lm).levelmark.asked());
    const { raised, sunk, home, flat } = await tab.evaluate(() => {
      const p = (window as unknown as Lm).levelmark;
      return { raised: p.raised, sunk: p.sunk, home: p.home, flat: p.height(p.home[0], p.home[1]) };
    });

    const none = await chip();
    check('no level: no chip', none.hidden, JSON.stringify(none));
    const was = { raised: await colour(raised), sunk: await colour(sunk) };

    await saw(flat);
    const set = await chip();
    check('the island\'s level in a ground read: the chip at once, with its height', !set.hidden && set.text === `Level ${(flat / 10).toFixed(1)} m`, JSON.stringify(set));

    const r = await colour(raised);
    const s = await colour(sunk);
    const h = await colour([home[0] + 1, home[1] + 1]);
    check('a corner above the level: amber', amber(r, was.raised), `${say(r)} (no level ${say(was.raised)})`);
    check('a corner below the level: blue', blue(s, was.sunk), `${say(s)} (no level ${say(was.sunk)})`);
    check('a corner at the level: green', green(h), say(h));

    const at: [number, number] = [home[0] + 1, home[1]];
    await tab.evaluate((a) => (window as unknown as Lm).levelmark.take(a[0], a[1]), at);
    const asks = await asked();
    check('Set level here: asked of the island at its corner', asks.some((x) => x.id === 'take_level' && x.cx === at[0] && x.cy === at[1]), JSON.stringify(asks));
    // The island answers with that corner's height, the yard's: the level is the same, and the corner is news.
    await saw(flat);
    const named = await chip();
    check('its answer: the chip names the corner', named.title.includes(`set at corner ${at[0]}, ${at[1]}`), named.title);

    await tab.click('.hud-level-clear');
    const cleared = await asked();
    check('× on the chip: Clear level asked of the island', cleared.at(-1)?.id === 'clear_level', JSON.stringify(cleared.at(-1)));
    await saw(null);
    const gone = await chip();
    check('the island\'s level cleared: no chip', gone.hidden, JSON.stringify(gone));
    const after = await colour(raised);
    check('and no marks on the ground', !amber(after, was.raised), say(after));
    check('and the page threw nothing', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
  }
}

finish('levelmark');
