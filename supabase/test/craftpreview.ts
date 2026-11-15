/**
 * The crafting window's preview (`src/ui/craftpreview.ts`, `src/ui/panels/craft.ts`).
 *
 * Asked for: "the crafting menu should show a preview of the item for anything that has one, e.g. gear or furniture",
 * and then "that gear should update when changing material selection, e.g. pine to cedar barrel". So this asks, in
 * Chromium, of the window as players get it (the built page's head, its stylesheets and policy):
 *
 *   * which things have one, read off the models (`previewOf`): every recipe's thing that is a piece with a model, a
 *     hull or a vehicle, what else is set down (a work post, a trap), a piece the figure draws worn, a weapon, a tool
 *     the figure works with, or a thing with a model of its own (a loaf, a candle) has the kind it should, and what
 *     has no model (a stew, a plank, a scroll) has none;
 *   * a row clicked shows its thing's preview, of the right kind, drawn, the row lit; a recipe with no model shows no
 *     strip at all; the pointer resting on another row shows that one's, and off the window the chosen one's again;
 *   * the material chosen on a row is the preview's at once: a barrel in pine and in cedar are two pictures, a sword
 *     in iron and in gold two more, and back to pine is the pine picture again;
 *   * a search puts the recipe that makes the thing typed first, under "Makes" (a mould for what it casts), ahead of
 *     every recipe that only takes it: "plank" the plank, "nail" the nail mould;
 *   * the window shut stops the drawing; opened again it draws again;
 *   * Animations Off draws a still frame and then nothing.
 *
 * With `CRAFTPREVIEW_SHOTS` set to a directory, it saves pictures there at twice the pixels: the window with a piece of
 * furniture, armour, a weapon, a tool, a vehicle and a loaf chosen; the barrel in pine and cedar and the sword in iron and gold;
 * the window narrow and on a phone; by night; and the frames of the preview turning (`turn-*.png`).
 *
 * Needs no database, and the built site at the root (`npm run build`). Run from the repository root:
 *
 *   npx esbuild supabase/test/craftpreview.ts --bundle --platform=node --format=esm \
 *     --external:esbuild --external:playwright-core --outfile=node_modules/.cache/craftpreview.mjs \
 *     && node node_modules/.cache/craftpreview.mjs
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import type { PreviewState } from './craftpreview-page';
import { check, finish } from './harness';

const ROOT = resolve('.');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
/** Frames saved of the preview turning, with `CRAFTPREVIEW_SHOTS`: two turns' worth of the eight ways round. */
const TURN_FRAMES = 32;

function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}

const options = browserOptions();
const browser = options && existsSync(join(ROOT, 'index.html')) ? await chromium.launch(options).catch(() => null) : null;
if (!browser) {
  console.log('craftpreview: no Chromium here (set CHROME_PATH), or no built site; the window is not drawn.');
  if (process.env.CRAFTPREVIEW_STRICT) check('drawn: Chromium', false);
} else {
  const shots = process.env.CRAFTPREVIEW_SHOTS;
  if (shots) mkdirSync(shots, { recursive: true });
  const made = new Map<string, string>();
  const head = readFileSync(join(ROOT, 'index.html'), 'utf8')
    .replace(/\s*<script type="module"[^>]*><\/script>/g, '')
    .replace(/\s*<link rel="modulepreload"[^>]*>/g, '');
  const bundled = await build({
    entryPoints: [join(ROOT, 'supabase/test/craftpreview-page.ts')], bundle: true, format: 'esm', write: false, logLevel: 'error', target: 'es2022',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
  });
  made.set('__craft.js', bundled.outputFiles[0].text);
  made.set('__craft.html', head.replace('</body>', '<script type="module" src="./__craft.js"></script>\n</body>'));
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '');
    if (made.has(path)) {
      res.writeHead(200, { 'content-type': TYPES[extname(path)] }).end(made.get(path));
      return;
    }
    const file = join(ROOT, path || 'index.html');
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  try {
    const tab = await (await browser.newContext({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: 2 })).newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
    await tab.goto(`${base}/__craft.html`, { waitUntil: 'load' });
    await tab.waitForFunction(() => !!(window as unknown as { craft?: unknown }).craft, null, { timeout: 60_000 });
    const call = <T>(f: string, ...args: unknown[]): Promise<T> =>
      tab.evaluate(([f, args]) => {
        const api = (window as unknown as { craft: Record<string, (...a: unknown[]) => unknown> }).craft;
        return api[f as string](...(args as unknown[]));
      }, [f, args] as const) as Promise<T>;
    await tab.evaluate(() => (window as unknown as { craft: { ready: Promise<void> } }).craft.ready);
    const shot = async (name: string): Promise<void> => {
      if (!shots) return;
      const b = await call<{ x: number; y: number; w: number; h: number }>('box');
      const R = 40;
      await tab.screenshot({ path: join(shots, name), clip: { x: Math.max(0, b.x - R), y: Math.max(0, b.y - R), width: b.w + 2 * R, height: b.h + 2 * R } });
    };
    await call('look', 'runecut', 'day');
    await call('open', 420, 520);
    await call('only');

    // Which things have one: read off the models, every recipe's thing.
    const kinds = await call<Record<string, string | null>>('kinds');
    const want: Record<string, string | null> = {
      barrel: 'furniture', chair: 'furniture', chest: 'furniture', smelter: 'furniture', kiln: 'furniture', memorial_stone: 'furniture',
      work_post: 'furniture', snare: 'furniture', deed_stake: 'furniture', bread: 'model', candle: 'model', lantern: 'model',
      rowing_boat: 'vehicle', sailing_boat: 'vehicle', cart: 'vehicle', wagon: 'vehicle',
      leather_jerkin: 'gear', scale_helm: 'gear', cloth_tunic: 'gear', wooden_shield: 'gear', toolbelt: 'gear', jewelled_ring: 'gear',
      sword: 'held', long_bow: 'held', battle_axe: 'held', mallet: 'held', saw: 'held', shovel: 'held', needle: 'held',
      plank: null, stew: null, rope: null, bandage: null, flamearrow_scroll: null, backpack: null, sack: null,
    };
    const wrong = Object.entries(want).filter(([id, k]) => kinds[id] !== k).map(([id, k]) => `${id}: ${kinds[id]} (want ${k})`);
    check('which things have a preview, read off the models', wrong.length === 0, wrong.join('; '));
    const counts: Record<string, number> = {};
    for (const k of Object.values(kinds)) counts[k ?? 'none'] = (counts[k ?? 'none'] ?? 0) + 1;
    console.log(`  recipes' things by preview: ${JSON.stringify(counts)}`);

    // A row chosen: its preview, of its kind, drawn, the row lit.
    const barrel = await call<string>('recipeOf', 'barrel');
    const sword = await call<string>('recipeOf', 'sword');
    const plank = await call<string>('recipeOf', 'plank');
    const each: Array<[string, string, string]> = [
      ['furniture', 'barrel', 'furniture'], ['gear', 'leather_jerkin', 'armour'], ['held', 'sword', 'weapon'], ['held', 'mallet', 'tool'], ['vehicle', 'rowing_boat', 'vehicle'], ['model', 'bread', 'food'],
    ];
    for (const [kind, item, name] of each) {
      const id = await call<string>('recipeOf', item);
      await call<PreviewState>('choose', id);
      // (on this machine's software GL a frame of a body costs most of a second, so the next waits for it)
      await call('wait', 3500);
      const s = await call<PreviewState>('state', id);
      check(`chosen: ${item}, a ${kind} preview drawn, the row lit`, s.shown && s.kind === kind && s.item === item && s.running && s.share > 0.02 && s.chosen,
        `${JSON.stringify(s)}; ${await call<string>('stats')}`);
      await shot(`${name}.png`);
    }
    const none = await call<PreviewState>('choose', plank);
    check('chosen: a plank, no model, no preview and no strip', !none.shown && none.kind === null && !none.running, JSON.stringify(none));

    // The pointer on another row shows that one's; off the window, the chosen one's again.
    await call<PreviewState>('choose', barrel);
    const pointed = await call<PreviewState>('point', sword);
    const back = await call<PreviewState>('away');
    check('pointed at: the sword shown; off the window, the chosen barrel again', pointed.item === 'sword' && back.item === 'barrel', `${pointed.item} → ${back.item}`);

    // The material chosen is the preview's at once.
    const woods = await call<string[]>('choices', barrel);
    const pine = await call<PreviewState>('material', barrel, 'Pine');
    await call('freeze');
    await call('frameAt', 0);
    const pinePic = await call<PreviewState>('state', barrel);
    await shot('barrel-pine.png');
    await call('thaw');
    const cedar = await call<PreviewState>('material', barrel, 'Cedar');
    await call('freeze');
    await call('frameAt', 0);
    const cedarPic = await call<PreviewState>('state', barrel);
    await shot('barrel-cedar.png');
    await call('thaw');
    await call<PreviewState>('material', barrel, 'Pine');
    await call('freeze');
    await call('frameAt', 0);
    const pineAgain = await call<PreviewState>('state', barrel);
    await call('thaw');
    check('a barrel in pine, then cedar: the preview in each, two pictures; pine again, the pine picture',
      woods.includes('Pine') && woods.includes('Cedar') && pine.material === 'Pine' && cedar.material === 'Cedar' && cedar.line === 'Cedar'
      && pinePic.sum !== cedarPic.sum && pineAgain.sum === pinePic.sum,
      `${woods.join(',')}; ${pine.material} ${pinePic.sum} / ${cedar.material} ${cedarPic.sum} / ${pineAgain.sum}`);
    await call<PreviewState>('choose', sword);
    const metals = await call<string[]>('choices', sword);
    await call<PreviewState>('material', sword, 'iron');
    await call('wait', 800);
    await call('freeze');
    await call('frameAt', 0);
    const iron = await call<PreviewState>('state', sword);
    await shot('sword-iron.png');
    await call('thaw');
    await call<PreviewState>('material', sword, 'gold');
    await call('wait', 800);
    await call('freeze');
    await call('frameAt', 0);
    const gold = await call<PreviewState>('state', sword);
    await shot('sword-gold.png');
    await call('thaw');
    check('a sword in iron, then gold: its head in each metal, two pictures',
      metals.includes('iron') && metals.includes('gold') && iron.material === 'iron' && gold.material === 'gold' && iron.sum !== gold.sum,
      `${metals.join(',')}; ${iron.material} ${iron.sum} / ${gold.material} ${gold.sum}`);

    // Searching: what makes the thing first, under "Makes", ahead of everything that only takes it.
    {
      type Row = { recipe: string; result: string; section: string };
      const planks = await call<Row[]>('search', 'plank');
      const nails = await call<Row[]>('search', 'nail');
      const takesNails = new Set(await call<string[]>('takes', 'nail'));
      const firstTaker = nails.findIndex((r) => takesNails.has(r.recipe));
      const lastMaker = nails.reduce((k, r, i) => (r.result === 'nail_mould' || r.result === 'nail' ? i : k), -1);
      check('searched "plank": the plank recipe first, under Makes', planks[0]?.result === 'plank' && planks[0]?.section === 'Makes', JSON.stringify(planks.slice(0, 4)));
      check('searched "nail": the nail mould first, every recipe making nails before any that takes them',
        nails[0]?.result === 'nail_mould' && nails[0]?.section === 'Makes' && firstTaker > lastMaker && lastMaker >= 0, `${JSON.stringify(nails.slice(0, 4))} maker…${lastMaker} taker ${firstTaker}`);
      await call('search', '');
    }

    // The window shut: no drawing; opened again, drawing.
    await call<PreviewState>('choose', barrel);
    await call('wait', 300);
    const shut = await call<PreviewState>('close');
    await call('wait', 500);
    const shutLater = await call<PreviewState>('state');
    check('the window shut: the preview stops', !shut.running && shutLater.frames === shut.frames, `${shut.frames} → ${shutLater.frames}`);
    await call('open', 420, 520);
    await call('only');
    await call('wait', 400);
    const reopened = await call<PreviewState>('state', barrel);
    check('opened again: drawing again', reopened.running && reopened.frames > shutLater.frames, JSON.stringify(reopened));

    // The preview turning, frame by frame.
    if (shots) {
      await call('freeze');
      for (let i = 0; i < TURN_FRAMES; i++) {
        await call('frameAt', (i / TURN_FRAMES) * 2 * 8 * 1.25);
        await tab.locator('.craft-preview-pic').screenshot({ path: join(shots, `turn-${String(i).padStart(3, '0')}.png`) });
      }
      await call('thaw');
    }

    // Animations off: a still frame, then nothing.
    await call('animations', false);
    await call<PreviewState>('choose', await call<string>('recipeOf', 'leather_jerkin'));
    await call('wait', 2600);
    const r1 = await call<PreviewState>('state');
    await call('wait', 1500);
    const r2 = await call<PreviewState>('state');
    check('Animations Off: a still frame, and no more drawing', r1.shown && !r1.running && r1.frames === r2.frames && r2.share > 0.02, `${JSON.stringify(r1)} → ${r2.frames}`);
    await call('animations', true);
    await call('wait', 300);
    const moving = await call<PreviewState>('state');
    check('Animations back On: moving again', moving.running, JSON.stringify(moving));

    // Narrow and on a phone: a thumbnail beside the name; by night.
    if (shots) {
      await call<PreviewState>('choose', barrel);
      // A narrow window (the craft body's own narrow, 280 pixels across or under): the thumbnail.
      await call('open', 270, 520);
      await call('only');
      await call('wait', 800);
      await shot('narrow.png');
      // A phone's screen (`screen.ts` marks it narrow and a phone): the window the screen's width, the thumbnail.
      const phone = await (await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
      await phone.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
      await phone.goto(`${base}/__craft.html`, { waitUntil: 'load' });
      await phone.waitForFunction(() => !!(window as unknown as { craft?: unknown }).craft, null, { timeout: 60_000 });
      await phone.evaluate(async (id) => {
        const api = (window as unknown as { craft: { ready: Promise<void>; look: (s: string, l: string) => Promise<void>; open: () => Promise<unknown>; only: () => void; choose: (id: string) => Promise<unknown>; wait: (ms: number) => Promise<void> } }).craft;
        await api.ready;
        await api.look('runecut', 'day');
        await api.open();
        api.only();
        await api.choose(id);
        await api.wait(800);
      }, barrel);
      const classes = await phone.evaluate(() => document.getElementById('ui')?.className ?? '');
      console.log(`  phone: #ui ${classes}`);
      await phone.screenshot({ path: join(shots, 'phone.png'), fullPage: true });
      await phone.close();
      await call('look', 'runecut', 'night');
      await call('open', 420, 520);
      await call('only');
      await call('wait', 800);
      await shot('night.png');
      await call('look', 'classic', 'day');
      await call('wait', 800);
      await shot('classic.png');
    }
    check('drawn: nothing thrown', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
    server.close();
  }
}

finish('the crafting window preview');
