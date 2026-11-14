/**
 * A field still to tend and a tended one look different at every stage the
 * Tend action takes, and a ripe one is one picture either way.
 *
 * Asked for: "a distinct Tendable/Tended difference on each crop model for the
 * cycles pre harvest". Tend goes on a crop that is not ripe and not tended at
 * the stage it is at (`tend_crop`, the island's `farm_refusal`), in a winter as
 * well, so sown, sprouting and growing each show it: dry pale soil and weeds
 * still to tend, dark damp soil with water in the furrows tended.
 *
 * Drawn in Chromium on the page `croptend-page.ts` builds: every crop at every
 * stage, by day, in a winter and at night, baked as a field tile (`fieldBake`)
 * and drawn flat for the low-end graphics (`cropFlatSprite`), still to tend
 * and tended. Before ripe the two differ over at least `APART` of the pixels
 * either covers, for every crop and stage; at ripe they are the same picture.
 * And a planter's trim keeps tended before ripe and drops it at ripe.
 *
 * Needs a Chromium: the one in `CHROME_PATH`, Playwright's, or an installed
 * Chrome. With none it says so and passes, unless `CROPTEND_STRICT` is set, as
 * it is in CI.
 */
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Pair } from './croptend-page';
import { ok, bad, check } from './harness';

/** The share of a tile's pixels that must differ between still to tend and tended, at the least. */
const APART = 0.25;
/** The same for the flat drawing of the low-end graphics, which is mostly plants. */
const FLAT_APART = 0.4;

/** A Chromium to drive, as `crowd.ts` finds one, or null. */
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

const options = browserOptions();
if (!options) {
  console.log('croptend: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  process.exit(process.env.CROPTEND_STRICT ? 1 : 0);
}

const bundled = await build({
  // From the repository's root, where the suite is run.
  entryPoints: [resolve('supabase/test/croptend-page.ts')],
  bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});

const browser = await chromium.launch(options);
try {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  const thrown: string[] = [];
  tab.on('pageerror', (e) => thrown.push(e.message));
  await tab.setContent('<html><body style="margin:0"></body></html>');
  await tab.addScriptTag({ content: bundled.outputFiles[0].text });
  if (thrown.length) throw new Error(`the page threw: ${thrown.join('; ')}`);
  type Page = { cropTend: { pairs: () => Pair[]; trims: () => string[] } };
  const pairs = await tab.evaluate(() => (window as unknown as Page).cropTend.pairs());
  const RIPE = Math.max(...pairs.map((p) => p.stage));
  const when = (p: Pair): string => `${p.crop} at stage ${p.stage}${p.dormant ? ' in a winter' : ''}${p.step < 0 ? ' at night' : ''}`;
  const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

  const early = pairs.filter((p) => p.stage < RIPE);
  check(`every crop at every stage before ripe (${early.length}) is a picture of its own still to tend and tended`, early.every((p) => !p.same),
    early.filter((p) => p.same).map(when).join('; '));
  const near = early.filter((p) => p.field < APART);
  check(`and its field tile differs over ${pct(APART)} of its pixels or more`, near.length === 0,
    near.length ? near.map((p) => `${when(p)}: ${pct(p.field)}`).join('; ') : `the least ${pct(Math.min(...early.map((p) => p.field)))}`);
  const flatNear = early.filter((p) => p.flat < FLAT_APART);
  check(`and drawn flat, over ${pct(FLAT_APART)}`, flatNear.length === 0,
    flatNear.length ? flatNear.map((p) => `${when(p)}: ${pct(p.flat)}`).join('; ') : `the least ${pct(Math.min(...early.map((p) => p.flat)))}`);
  const ripe = pairs.filter((p) => p.stage === RIPE);
  check(`ripe (${ripe.length}), tended or not is the one picture`, ripe.every((p) => p.same && p.field === 0 && p.flat === 0),
    ripe.filter((p) => !p.same || p.field || p.flat).map(when).join('; '));
  const trims = await tab.evaluate(() => (window as unknown as Page).cropTend.trims());
  check('a planter\'s trim says its crop, stage and tended, and is tended only before ripe', trims.length === 0, trims.slice(0, 3).join('; '));
  if (thrown.length) check('and the page threw nothing', false, thrown.join('; '));
  await ctx.close();
} finally {
  await browser.close();
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(bad.length ? `\n${bad.length} wrong` : '\nall as they should be');
process.exit(bad.length ? 1 : 0);
