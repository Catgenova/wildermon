/**
 * Does the built page start?
 *
 * Every other check in this repository runs the rules in Node, from the
 * source, bundled by esbuild. None of them loads the page the players get:
 * the one Vite builds into `index.html` and `assets/`, whose modules run in
 * the order Rolldown chooses. That order is not esbuild's, and when two
 * modules import each other it decides which of them runs first -- which is
 * how `baubles.ts` → `game.ts` → `actions.ts` → `baubles.ts` left `ACTIONS`
 * spreading a `BAUBLE_ACTIONS` that did not exist yet. The page threw as it
 * loaded and stood on "Raising an island…" for everybody, for two hours,
 * with every test green.
 *
 * So this serves the built site from the repository root, opens it in a real
 * browser with every request off this machine refused, and asks it to start:
 *
 *   * `index.html` must load every module without throwing and, with no
 *     island to reach, stop on the boot card's "Can't reach the island" with
 *     its Retry. There is no single-player game to come up instead;
 *   * `account.html`, the landing page, must load without throwing;
 *   * `wildermon.html`, the stud book, must load without throwing.
 *
 * Anything thrown on the way is a failure, with the error and where it was,
 * and so is anything the page's Content-Security-Policy refuses or ignores:
 * the policy in each page's <meta> has to name everything the page loads and
 * talks to, the island included (its requests are refused here only after the
 * policy has let them through). A violation is whatever the page's
 * `securitypolicyviolation` event reports, Trusted Types' included, as well as
 * what the console says.
 *
 * Under the game page's head as built -- its policy, Trusted Types, import map
 * and stylesheets -- it also opens:
 *
 *   * the game once you are in it (`supabase/test/panels-page.ts`): every
 *     window open, every journal tab, the help, the palette and the emotes, and
 *     chat in the log that is markup and links. No violation, nothing thrown,
 *     the chat shown as its own text and never as a link or an element, and no
 *     link in the windows to anything but this site or https:;
 *   * a probe (`supabase/test/policy-probe-page.ts`) that tries what the policy
 *     is there to refuse -- a string into innerHTML, a script from another
 *     site, eval, a style attribute, a <style> -- and must be refused each time;
 *
 * and, as built:
 *
 *   * the game page in a frame on another origin, which must show its
 *     `FRAMED` card (src/page-guard.ts) and not start;
 *   * the integrity hashes (scripts/sri.mjs --check), and the game page with one
 *     of the modules it imports changed by a byte, which must not start.
 *
 * It needs a Chromium. It uses `CHROME_PATH` if that is set, then the one
 * Playwright keeps under `PLAYWRIGHT_BROWSERS_PATH`, then an installed Google
 * Chrome. With none of them it says so and passes, unless `BOOT_CHECK_STRICT`
 * is set, as it is in CI, where a check that cannot run is a failure.
 */
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

// The repository root, or another built site to check (`BOOT_CHECK_ROOT`), such as an older deploy's.
const ROOT = resolve(process.env.BOOT_CHECK_ROOT ?? new URL('..', import.meta.url).pathname);
const STRICT = !!process.env.BOOT_CHECK_STRICT;
/** How long the game gets to come up before it counts as stuck. */
const BOOT_WAIT = 45_000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

/** Pages and scripts made here for the checks below, by path: served as if they were in the root. */
const MADE = new Map();

/** The repository root, as GitHub Pages serves it, and what is in `MADE`. */
function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '');
    const made = MADE.get(path);
    if (made) { res.writeHead(200, { 'content-type': TYPES[extname(path)] }).end(made); return; }
    let file = join(ROOT, path || 'index.html');
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

/** A Chromium to drive, or null when there is none here. */
function browserOptions() {
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
  const said = 'boot check: no Chromium here (set CHROME_PATH), so the built page was not opened.';
  if (STRICT) {
    console.error(`${said} It has to be, here.`);
    process.exit(1);
  }
  console.log(said);
  process.exit(0);
}

/*
 * The pages made for the checks: the game page's head as built, its own
 * module script and preloads taken out, and one of the test pages bundled in
 * their place as a script of this site's.
 */
const SRC = new URL('..', import.meta.url).pathname;
const builtHead = readFileSync(join(ROOT, 'index.html'), 'utf8')
  .replace(/\s*<script type="module"[^>]*><\/script>/g, '')
  .replace(/\s*<link rel="modulepreload"[^>]*>/g, '');
for (const [name, entry] of [['__panels', 'supabase/test/panels-page.ts'], ['__probe', 'supabase/test/policy-probe-page.ts']]) {
  const bundled = await build({
    entryPoints: [join(SRC, entry)], bundle: true, format: 'esm', write: false, logLevel: 'error', target: 'es2022',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
  });
  MADE.set(`${name}.js`, bundled.outputFiles[0].text);
  MADE.set(`${name}.html`, builtHead.replace('</body>', `<script type="module" src="./${name}.js"></script>\n</body>`));
}
/** What a page framed by another site says (src/page-guard.ts). */
const FRAMED = readFileSync(join(SRC, 'src/page-guard.ts'), 'utf8').match(/export const FRAMED = '([^']*)'/)?.[1];

const server = await serve();
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
// Another origin, for a frame: the same server by another name.
const elsewhere = `http://localhost:${port}`;
MADE.set('__frame.html', `<!doctype html><title>frame</title><iframe src="${base}/index.html" width="800" height="600"></iframe>`);
const browser = await chromium.launch(options);
const bad = [];

/** Every violation the page's policy reports, from the first script on, in every frame. */
function watchViolations() {
  const seen = [];
  Object.defineProperty(window, '__violations', { value: seen });
  document.addEventListener('securitypolicyviolation', (e) => {
    seen.push(`${e.effectiveDirective} refused ${e.blockedURI || 'inline'}${e.sample ? ` (${e.sample})` : ''}${e.sourceFile ? ` at ${e.sourceFile}:${e.lineNumber}` : ''}`);
  });
}

/**
 * Open a page, nothing off this machine reachable, and collect what it throws
 * and what its policy refuses; `ready` says when it counts as up. With
 * `expected`, the violations are handed to it rather than counted as failures.
 */
async function open(path, ready, { expected, at = base, tamper } = {}) {
  const page = await browser.newPage();
  await page.addInitScript(watchViolations);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return route.abort();
    if (tamper) return tamper(route, url);
    return route.continue();
  });
  const thrown = [];
  const refused = [];
  page.on('console', (m) => { if (/Content Security Policy|Trusted ?Type|integrity/i.test(m.text())) refused.push(m.text()); });
  page.on('pageerror', (e) => thrown.push(`${e.message}\n    ${(e.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim()).join('\n    ')}`));
  try {
    await page.goto(`${at}/${path}`, { waitUntil: 'load' });
  } catch (e) {
    bad.push(`${path}: would not open: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    await page.close();
    return false;
  }
  let up = true;
  let result;
  try {
    result = await ready(page);
  } catch {
    up = false;
  }
  for (const frame of page.frames()) {
    for (const v of await frame.evaluate(() => window.__violations ?? []).catch(() => [])) refused.push(v);
  }
  if (expected) {
    await page.close();
    return expected({ up, result, thrown, refused });
  }
  for (const t of thrown) bad.push(`${path}: threw ${t}`);
  for (const r of refused) bad.push(`${path}: Content-Security-Policy: ${r}`);
  if (!up && !thrown.length) {
    const now = await page.evaluate(() => document.querySelector('#boot .boot-now')?.textContent ?? '').catch(() => '');
    bad.push(`${path}: did not come up within ${BOOT_WAIT / 1000}s${now ? `; the boot screen says "${now.trim()}"` : ''}`);
  }
  await page.close();
  return up && !thrown.length && !refused.length ? (result ?? true) : false;
}

const game = await open('index.html', (page) => page.waitForSelector('#boot .boot-retry', { timeout: BOOT_WAIT }));
const landing = await open('account.html', (page) => page.waitForTimeout(2000));
const book = existsSync(join(ROOT, 'wildermon.html')) ? await open('wildermon.html', (page) => page.waitForTimeout(1000)) : null;

/* In the game: every window, the chat as text. */
const panels = await open('__panels.html', async (page) => {
  await page.waitForFunction(() => window.panels?.done, null, { timeout: BOOT_WAIT });
  return page.evaluate(() => window.panels);
});
if (panels) {
  const p = panels;
  if (p.opened.length < 10) bad.push(`in the game: only ${p.opened.length} windows opened (${p.opened.join(', ')})`);
  if (!p.help) bad.push('in the game: the help was not built');
  if (p.shown.some((s) => !s)) bad.push(`in the game: chat lines not shown as their own text: ${p.shown.map((s, i) => (s ? '' : i)).filter((i) => i !== '').join(', ')}`);
  if (p.made.length) bad.push(`in the game: chat or names made into elements: ${p.made.join('; ')}`);
  if (p.logLinks) bad.push(`in the game: ${p.logLinks} link(s) in the event log; chat is never linkified`);
  if (p.badLinks.length) bad.push(`in the game: links to neither this site nor https:, or without noopener: ${p.badLinks.join(', ')}`);
  if (!p.escaped) bad.push('in the game: html`` did not put markup in as text');
  if (p.pwned) bad.push('in the game: a chat line ran script');
}

/* The policy refuses what it should, and reports it. */
const probe = await open('__probe.html', async (page) => {
  await page.waitForFunction(() => window.probe?.done, null, { timeout: BOOT_WAIT });
  return page.evaluate(() => window.probe);
}, {
  expected: ({ up, result, thrown, refused }) => {
    if (!up || !result) { bad.push(`policy probe: did not finish${thrown.length ? `; threw ${thrown[0]}` : ''}`); return false; }
    const wrong = Object.entries(result).filter(([, ok]) => !ok).map(([k]) => k);
    for (const k of wrong) bad.push(`policy probe: ${k} is false`);
    for (const t of thrown) bad.push(`policy probe: threw ${t}`);
    for (const d of ['require-trusted-types-for', 'style-src-attr', 'style-src-elem']) {
      if (!refused.some((r) => r.startsWith(d))) bad.push(`policy probe: no ${d} violation reported`);
    }
    return !wrong.length && !thrown.length;
  },
});

/* In another site's frame: the card, and nothing started. */
const framed = await open('__frame.html', async (page) => {
  const frame = page.frames().find((f) => f.url().startsWith(base));
  await frame.waitForFunction((said) => document.body?.textContent?.includes(said), FRAMED, { timeout: BOOT_WAIT });
  await page.waitForTimeout(500);
  return frame.evaluate(() => ({ started: !!document.querySelector('#ui *'), boot: !!document.querySelector('#boot') }));
}, {
  at: elsewhere,
  expected: ({ up, result }) => {
    if (!FRAMED) { bad.push('framed: no FRAMED in src/page-guard.ts'); return false; }
    if (!up) { bad.push(`framed: the game page in another site's frame did not say "${FRAMED}"`); return false; }
    if (result.started || result.boot) { bad.push('framed: the game page started in another site\'s frame'); return false; }
    return true;
  },
});

/*
 * Integrity: the hashes are the files', and a module changed by a byte is
 * refused -- one the entry imports, which only the import map vouches for once
 * the preloads are gone, or the entry itself when it imports none.
 */
const builtIndex = readFileSync(join(ROOT, 'index.html'), 'utf8');
const changed = `/${builtIndex.match(/<link rel="modulepreload"[^>]*href="\.\/(assets\/[\w.-]+\.js)/)?.[1]
  ?? builtIndex.match(/<script type="module"[^>]*src="\.\/(assets\/[\w.-]+\.js)/)?.[1]}`;
let sri = true;
try {
  execFileSync('node', [join(SRC, 'scripts/sri.mjs'), '--check'], { env: { ...process.env, SRI_ROOT: ROOT }, stdio: ['ignore', 'ignore', 'pipe'] });
} catch (e) {
  sri = false;
  bad.push(`integrity: ${String(e.stderr ?? e).trim()}`);
}
const tampered = sri && await open('index.html', (page) => page.waitForSelector('#boot .boot-retry', { timeout: 8000 }), {
  // The page without its preloads, so the module comes in only as the entry imports it, through the import map.
  tamper: async (route, url) => {
    if (url.pathname === '/index.html') {
      const res = await route.fetch();
      return route.fulfill({ response: res, body: (await res.text()).replace(/\s*<link rel="modulepreload"[^>]*>/g, '') });
    }
    if (url.pathname === changed) {
      const res = await route.fetch();
      return route.fulfill({ response: res, body: `${await res.text()}\n;` });
    }
    return route.continue();
  },
  expected: ({ up, refused }) => {
    if (up) { bad.push(`integrity: the game page started with ${changed} changed`); return false; }
    if (!refused.some((r) => /integrity/i.test(r))) bad.push(`integrity: no integrity failure reported for a changed ${changed}`);
    return true;
  },
});

await browser.close();
server.close();

const csp = bad.some((b) => b.includes('Content-Security-Policy'));
console.log(`boot check: the game page ${game ? 'loads and says it cannot reach the island' : 'DOES NOT load'}; the landing page ${landing ? 'loads' : 'DOES NOT load'}`
  + `${book === null ? '' : `; the stud book ${book ? 'loads' : 'DOES NOT load'}`}; ${panels ? `in the game, ${panels.opened.length} windows and ${panels.tabs.length} journal tabs open with chat shown as text` : 'in the game, NOT every window opens cleanly'}`
  + `; ${csp ? 'Content-Security-Policy violations' : 'no Content-Security-Policy or Trusted Types violations'}; the policy ${probe ? 'refuses' : 'DOES NOT refuse'} raw HTML, foreign script, eval and inline style`
  + `; in another site's frame it ${framed ? 'does not start' : 'STARTS'}; integrity ${sri && tampered ? 'holds' : 'DOES NOT hold'}.`);
for (const b of bad) console.error(`  ${b}`);
if (bad.length) process.exit(1);
