/**
 * A page loaded before a deploy, asked for a wildermon line it had not loaded yet.
 *
 * Reported: "Some wildermon aren't rendering": an Ironemole in open grass drawn as its name tag and health bar and no
 * body, and in the Field guide most kinds' cards their name and no picture. Each line's models are a module the page
 * fetches the first time a body of it is wanted (`src/render/wildermon.ts`), and the page's import map pins every
 * module's hash (scripts/sri.mjs). A deploy puts the new build's files at the same addresses: a page opened before it
 * has every line it had not loaded yet refused, for as long as it stays open. The refusal was caught and dropped, the
 * module asked for again every frame a body of the line was in view, and nothing told the player to reload.
 *
 * Here the page is served as the site is, every module a file of its own under an import map of their hashes (bundled
 * with esbuild, split, rather than by Vite), and in Chromium:
 *
 *   * a line the page loaded before the deploy is drawn after it, and a line it had not is refused;
 *   * the refused line is asked for at most twice in three seconds of frames with a body of it in view, not every frame;
 *   * the corner's button (`updateButton`), hidden with the site on the page's own deploy, says `STALE_BUILD` within a
 *     second of the refusal, the site being on a later one, where it used to wait for its next look two minutes on;
 *   * reloaded on the new build, the line comes and the body is drawn.
 *
 * `STALE_SHOTS=<dir>` keeps a picture of the page before the reload and after. Needs a Chromium: the one in
 * `CHROME_PATH`, Playwright's, or an installed Chrome. With none it says so and passes, unless `STALE_STRICT` is set.
 */
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { STALE_BUILD } from '../../src/version';
import { check, finish } from './harness';

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
  console.log('staleline: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  process.exit(process.env.STALE_STRICT ? 1 : 0);
}

/** The page's deploy, and the one the site is on once it has moved. */
const RUNNING = 100;
const LATER = 101;

const out = mkdtempSync(join(tmpdir(), 'staleline-'));
await build({
  entryPoints: [resolve('supabase/test/staleline-page.ts')],
  bundle: true, splitting: true, format: 'esm', outdir: out, entryNames: '[name]', chunkNames: '[name]-[hash]', logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: String(RUNNING) },
});
const modules = readdirSync(out).filter((n) => n.endsWith('.js'));
// The Ironemole's line: the module its `import()` fetches.
const IRON = modules.find((n) => /^wild-iron-/.test(n));
check('the Ironemole\'s line is a module of its own', !!IRON, IRON ?? `${modules.length} modules`);

/** What the server hands out: each module's bytes, as the build now on the site has them. */
const bytes = new Map(modules.map((n) => [n, readFileSync(join(out, n))]));
const sri = (b: Buffer): string => `sha384-${createHash('sha384').update(b).digest('base64')}`;
/** The page as the site has it now: an import map pinning every module's hash, then the page's own module. */
const page = (): string => {
  const integrity: Record<string, string> = {};
  for (const [n, b] of bytes) integrity[`./${n}`] = sri(b);
  return `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="./style.css"><style>body{margin:0;overflow:hidden}</style>
<script type="importmap">${JSON.stringify({ imports: {}, integrity })}</script>
<script type="module" src="./staleline-page.js" integrity="${integrity['./staleline-page.js']}"></script>`;
};
let deploy = RUNNING;
let ironAsked = 0;
const server = createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname.slice(1);
  if (path === '' || path === 'index.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page());
    return;
  }
  if (path === 'style.css') {
    res.writeHead(200, { 'content-type': 'text/css' });
    res.end(readFileSync('src/style.css'));
    return;
  }
  if (path === 'assets/version.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ deploy }));
    return;
  }
  const b = bytes.get(path);
  if (!b) {
    res.writeHead(404);
    res.end();
    return;
  }
  if (path === IRON) ironAsked++;
  res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
  res.end(b);
});
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const port = (server.address() as { port: number }).port;

const shots = process.env.STALE_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });

const browser = await chromium.launch(options);
try {
  const tab = await (await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })).newPage();
  const thrown: string[] = [];
  tab.on('pageerror', (e) => thrown.push(e.message));
  /** An expression on the page's `staleLine`, awaited. */
  const api = <T>(expr: string): Promise<T> => tab.evaluate(`(async () => { const a = window.staleLine; return ${expr}; })()`) as Promise<T>;
  const shoot = async (name: string): Promise<void> => {
    if (shots) await tab.screenshot({ path: join(shots, name) });
  };
  await tab.goto(`http://127.0.0.1:${port}/index.html`);
  await tab.waitForFunction(() => !!(window as unknown as { staleLine?: unknown }).staleLine);

  // Before the deploy: a Cloudlet comes and is drawn, and the button stays hidden.
  await api(`a.put('woola', -2)`);
  await api(`a.frames(60)`);
  check('before the deploy, a line wanted comes', await api<boolean>(`a.drawn('woola')`));
  check('and the button is hidden, the site on the page\'s own deploy', (await api<{ hidden: boolean; text: string }>(`a.button()`)).hidden);

  // The deploy: the site moves on, and the Ironemole's line is new bytes the page's import map does not take.
  deploy = LATER;
  bytes.set(IRON as string, Buffer.concat([bytes.get(IRON as string) as Buffer, Buffer.from('\n;\n')]));
  await api(`a.put('mola', 2)`);
  await api(`a.frames(60)`);
  const said = await api<{ hidden: boolean; text: string }>(`a.button()`);
  check(`a line the page had not loaded is refused after the deploy`, !(await api<boolean>(`a.drawn('mola')`)));
  check('and the Cloudlet loaded before it is still drawn', await api<boolean>(`a.drawn('woola')`));
  check(`within a second the button says "${STALE_BUILD}"`, !said.hidden && said.text === STALE_BUILD, `${said.hidden ? 'hidden' : 'shown'}: "${said.text}"`);
  await api(`a.frames(120)`);
  check('the refused line is asked for at most twice in three seconds of frames, not every frame', ironAsked >= 1 && ironAsked <= 2, `asked ${ironAsked} times`);
  await shoot('stale.png');

  // Reloaded on the new build: the line comes, and the body is drawn.
  await tab.reload();
  await tab.waitForFunction(() => !!(window as unknown as { staleLine?: unknown }).staleLine);
  await api(`a.put('woola', -2)`);
  await api(`a.put('mola', 2)`);
  await api(`a.frames(60)`);
  check('reloaded on the new build, the line comes', await api<boolean>(`a.drawn('mola')`));
  await shoot('reloaded.png');
  check('nothing thrown', thrown.length === 0, thrown.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.close();
  rmSync(out, { recursive: true, force: true });
}

finish('A page loaded before a deploy, asked for a wildermon line it had not loaded');
