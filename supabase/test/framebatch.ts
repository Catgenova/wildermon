/**
 * The pack, the skill book and the belt drawn once a frame, and not while they are shut; what they show unchanged.
 *
 * The island tells the pack a row at a time (`Island.packRow`) and the skill book a word for each skill that rose and
 * one more (`island.hooks.mine`). Each word drew the whole Inventory list again, and the belt, and the whole Skills
 * window, shut or open, while nobody could see anything but the last. They ask `nextFrame` now (src/ui/repaint.ts),
 * which `UI.update` draws once each at the next frame. Drawn in Chromium (`framebatch-page.ts`), it asks:
 *
 *   * a dozen words on the pack in one breath draw the Inventory list once, at the next frame, and not before;
 *   * and what the window, the belt and the book show then is what each shows drawn afresh at once, markup for markup;
 *   * with the window shut, words on the pack draw nothing, frame after frame; opened, it is drawn once, and shows
 *     what it shows drawn afresh;
 *   * with the Skills window open, three skills rising show their numbers as the book has them at the next frame,
 *     each row flashing, and the window is as drawn afresh;
 *   * with it shut, the numbers stand while skills rise; opened, they are the book's, the risen rows flash, and the
 *     window is as drawn afresh;
 *   * loops hung on the belt in one breath show at the next frame as the belt drawn afresh;
 *   * and the page throws nothing.
 *
 * Needs a Chromium as `hoverkeep.ts` does; without one it says so and passes, unless `FRAMEBATCH_STRICT` is set, as
 * it is in CI.
 *
 *   npx esbuild supabase/test/framebatch.ts --bundle --platform=node --format=esm --packages=external \
 *     --outfile=node_modules/.cache/framebatch.mjs && node node_modules/.cache/framebatch.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import type { Driven } from './framebatch-page';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

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
  console.log('framebatch: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  process.exit(process.env.FRAMEBATCH_STRICT ? 1 : 0);
}

const bundled = await build({
  // From the repository's root, where the suite is run.
  entryPoints: [resolve('supabase/test/framebatch-page.ts')],
  bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});

type Win = { framebatch: Driven };
const browser = await chromium.launch(options);
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  const thrown: string[] = [];
  tab.on('pageerror', (e) => thrown.push(e.message));
  await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
  await tab.addStyleTag({ content: ['src/style.css', 'src/phone.css'].map((f) => readFileSync(resolve(f), 'utf8')).join('\n') });
  await tab.addScriptTag({ content: bundled.outputFiles[0].text });
  if (thrown.length) throw new Error(`the page threw: ${thrown.join('; ')}`);

  const results = await tab.evaluate(() => {
    const d = (window as unknown as Win).framebatch;
    const out: Record<string, unknown> = {};
    d.frame();
    const same = (a: Record<string, string>, b: Record<string, string>): string[] => Object.keys(a).filter((k) => a[k] !== b[k]);

    // A dozen words on the pack in one breath, the window open.
    let was = d.drawn();
    d.packWords(12);
    out.packBefore = d.drawn() - was;
    d.frame();
    out.packOnce = d.drawn() - was;
    let now = d.shown();
    out.packDiffer = same(now, d.afresh());

    // Shut: frames go by and nothing is drawn; opened, once.
    d.close('inventory');
    d.frame();
    was = d.drawn();
    for (let i = 0; i < 5; i++) {
      d.packWords(4);
      d.frame();
    }
    out.shutDrawn = d.drawn() - was;
    d.open('inventory');
    out.openDrawn = d.drawn() - was;
    d.frame();
    now = d.shown();
    out.openDiffer = same(now, d.afresh());

    // The book, open: three rise in one beat.
    d.open('skills');
    d.frame();
    const three = d.skills.slice(0, 3);
    d.rise(three);
    out.risenBefore = three.map((id) => d.skillSays(id));
    d.frame();
    out.risenOpen = three.map((id) => d.skillSays(id));
    now = d.shown();
    out.skillsDiffer = same(now, d.afresh());

    // Shut: the numbers stand; opened, the book's.
    d.close('skills');
    d.frame();
    const one = [d.skills[3]];
    const stood = d.skillSays(one[0]).row;
    for (let i = 0; i < 3; i++) {
      d.rise(one);
      d.frame();
    }
    out.shutStood = { stood, row: d.skillSays(one[0]).row };
    d.open('skills');
    out.openSkill = d.skillSays(one[0]);
    d.frame();
    now = d.shown();
    out.openSkillsDiffer = same(now, d.afresh());

    // Loops on the belt.
    for (let i = 0; i < 3; i++) d.pin(i);
    d.frame();
    now = d.shown();
    out.beltDiffer = same(now, d.afresh());
    return out;
  });

  const r = results as {
    packBefore: number; packOnce: number; packDiffer: string[]; shutDrawn: number; openDrawn: number; openDiffer: string[];
    risenBefore: Array<{ row: string; book: string; flash: boolean }>; risenOpen: Array<{ row: string; book: string; flash: boolean }>;
    skillsDiffer: string[]; shutStood: { stood: string; row: string }; openSkill: { row: string; book: string; flash: boolean };
    openSkillsDiffer: string[]; beltDiffer: string[];
  };
  check('a dozen words on the pack draw nothing before the next frame', r.packBefore === 0, `${r.packBefore} drawn`);
  check('and the Inventory list once at it', r.packOnce === 1, `${r.packOnce} drawn`);
  check('then the pack, the book and the belt show what each shows drawn afresh', r.packDiffer.length === 0, r.packDiffer.join(', '));
  check('with the window shut, words on the pack over five frames draw nothing', r.shutDrawn === 0, `${r.shutDrawn} drawn`);
  check('opened, the list is drawn once', r.openDrawn === 1, `${r.openDrawn} drawn`);
  check('and shows what it shows drawn afresh', r.openDiffer.length === 0, r.openDiffer.join(', '));
  check('three skills rising, the window open: their numbers wait for the next frame', r.risenBefore.every((s) => s.row !== s.book),
    r.risenBefore.map((s) => `${s.row}/${s.book}`).join(' '));
  check('and show the book\'s at it, each row flashing', r.risenOpen.every((s) => s.row === s.book && s.flash),
    r.risenOpen.map((s) => `${s.row}/${s.book}${s.flash ? ' flash' : ''}`).join(' '));
  check('and the Skills window is as drawn afresh', r.skillsDiffer.length === 0, r.skillsDiffer.join(', '));
  check('with the Skills window shut, a skill\'s number stands while it rises', r.shutStood.stood === r.shutStood.row, `${r.shutStood.stood} then ${r.shutStood.row}`);
  check('opened, it is the book\'s, and its row flashes', r.openSkill.row === r.openSkill.book && r.openSkill.flash, JSON.stringify(r.openSkill));
  check('and the window is as drawn afresh', r.openSkillsDiffer.length === 0, r.openSkillsDiffer.join(', '));
  check('loops hung on the belt in one breath show as the belt drawn afresh', r.beltDiffer.length === 0, r.beltDiffer.join(', '));
  check('the page throws nothing', thrown.length === 0, thrown.join('; '));
} finally {
  await browser.close();
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`the pack, the book and the belt drawn once a frame — ${ok.length} of ${ok.length}`);
