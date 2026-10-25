/**
 * Coming ashore and coming back, timed, against a stand-in island.
 *
 * The boot check (`boot-check.mjs`) opens the built page with nothing off this
 * machine reachable and asks only that it says so. This one gives the built
 * page an island to come ashore on: every call to the keeper is answered here,
 * after `LOGIN_CHECK_LATENCY` milliseconds (80 by default, a round trip to a
 * keeper across the sea), and the live connection is a stand-in Phoenix
 * socket that joins every channel it is asked to. Then:
 *
 *   * **ashore**: the page from navigation to its first frame (the boot card
 *     gone and the next frame drawn), with every step the boot bar showed, its
 *     width, and the share of the bar each step took. The bar must only ever
 *     grow, end full, and show every phase of `BOOT_PHASES`, in order;
 *   * **network**: the network cut (`offline`, every call refused, the socket
 *     closed) for `LOGIN_CHECK_OUTAGE` ms, a tile changed on the island while
 *     it is, and the network back. Timed from the network back to playable:
 *     every channel joined again, the tile that changed laid, and no
 *     Reconnecting banner;
 *   * **socket**: the same with only the live connection dropped by the far
 *     end and nothing said to the page, which is a keeper restarting or a
 *     wifi handover;
 *   * **again**: the page reloaded in the same browser, as somebody coming
 *     back tomorrow, with what it kept (the trees' bakes) kept;
 *
 * and, either way, the page must not have joined again (`rpc_join` once).
 *
 * `LOGIN_CHECK_ROOT` is the built site to open (the repository root by
 * default). `--measure` prints the timings and asserts nothing, for a site
 * built before these checks existed; `--shots <dir>` also saves the loading
 * screen, desktop and phone, held part way through. With `LOGIN_CHECK_RUNS`
 * each scenario is run that many times and the median is reported, and with
 * `LOGIN_CHECK_DEBUG` every call the stand-in island answers is printed.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = resolve(process.env.LOGIN_CHECK_ROOT ?? new URL('..', import.meta.url).pathname);
const STRICT = !!process.env.BOOT_CHECK_STRICT;
const MEASURE = process.argv.includes('--measure');
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const LATENCY = Number(process.env.LOGIN_CHECK_LATENCY ?? 80);
const OUTAGE = Number(process.env.LOGIN_CHECK_OUTAGE ?? 4000);
const RUNS = Math.max(1, Number(process.env.LOGIN_CHECK_RUNS ?? 1));
/** Longest a reconnect may take, from the network back to playable, before it counts as slow. */
const RECONNECT_MOST = Number(process.env.LOGIN_CHECK_RECONNECT_MOST ?? 2500);
const SRC = new URL('..', import.meta.url).pathname;
/** What the boot card calls each phase of the bar, in order, read from the source so the check cannot drift from it. */
const STEPS_SRC = join(SRC, 'src/ui/bootsteps.ts');
const PHASES = [...((existsSync(STEPS_SRC) ? readFileSync(STEPS_SRC, 'utf8') : '').match(/BOOT_PHASES[^=]*=\s*\[([\s\S]*?)\];/)?.[1] ?? '')
  .matchAll(/label: '([^']+)'/g)].map((m) => m[1]);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};

function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '');
    let file = join(ROOT, path || 'index.html');
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

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
  console.log('login check: no Chromium here (set CHROME_PATH).');
  process.exit(STRICT ? 1 : 0);
}

/** The keeper's address, as the built page has it. */
const KEEPER = readFileSync(join(SRC, 'src/net/supabase.ts'), 'utf8').match(/url: '(https:\/\/[^']+)'/)[1];
const WORLD = '00000000-0000-4000-8000-0000000000aa';
const UID = '00000000-0000-4000-8000-0000000000bb';
const SPAWN = { x: 2048.5, y: 2048.5 };

/** A session the page will take as signed in: unsigned, which nothing here checks. */
function session() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 365 * 86400;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp, session_id: 's' })}.x`;
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'tester@wurm.test', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  return { access_token: token, token_type: 'bearer', expires_in: 365 * 86400, expires_at: exp, refresh_token: 'r', user };
}

/** The stand-in island: what it has, what it has been asked, and whether the network is up. */
function makeIsland() {
  return {
    down: false,
    changes: [],
    calls: new Map(),
    sockets: new Set(),
    /** Doors held until `release` (for screenshots part way through). */
    hold: null,
    release: null,
  };
}

const json = (body, status = 200) => ({ status, body: JSON.stringify(body), contentType: 'application/json' });

function answer(isl, url, body) {
  const path = url.pathname;
  if (path.startsWith('/auth/v1/user')) return json(session().user);
  if (path.startsWith('/auth/v1/token')) return json(session());
  const door = /\/rest\/v1\/rpc\/(\w+)/.exec(path)?.[1];
  if (door) {
    isl.calls.set(door, (isl.calls.get(door) ?? 0) + 1);
    const args = body ? JSON.parse(body) : {};
    const n = isl.changes.length ? isl.changes[isl.changes.length - 1].n : 0;
    switch (door) {
      case 'rpc_my_name': return json('Tester');
      case 'rpc_build_check': return json({ ok: true });
      case 'rpc_join': return json({
        world: { id: WORLD, name: 'Stand-in', size: 4096, seed: 20261026, spawn_x: SPAWN.x, spawn_y: SPAWN.y, changes_from: 0, epoch: '2026-01-01T00:00:00Z' },
        you: { uid: UID, name: 'Tester', x: SPAWN.x, y: SPAWN.y, level: 0, look: null, stats: { health: 1, stamina: 1, hunger: 1, thirst: 1 } },
        new: false, time: 8 * 3600, hears: true, away: null,
      });
      case 'rpc_land_window': return json({ n, x0: args.p_x0, y0: args.p_y0, x1: args.p_x1, y1: args.p_y1, rows: [] });
      case 'rpc_settle': return json({ settled: 0, said: [] });
      case 'rpc_creatures': case 'rpc_swirls': return json([]);
      default: return json(null);
    }
  }
  const table = /\/rest\/v1\/(\w+)/.exec(path)?.[1];
  if (table) {
    isl.calls.set(table, (isl.calls.get(table) ?? 0) + 1);
    if (table === 'home') return json({ island: WORLD });
    if (table === 'tile_change') {
      const after = Number(/^gt\.(\d+)$/.exec(url.searchParams.get('n') ?? '')?.[1] ?? 0);
      return json(isl.changes.filter((c) => c.n > after));
    }
    return json([]);
  }
  return json(null);
}

const CORS = {
  'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
  'access-control-allow-methods': '*', 'access-control-expose-headers': '*',
};

async function openGame(browser, isl, { viewport = { width: 1280, height: 800 }, mobile = false } = {}) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await context.newPage();
  const thrown = [];
  page.on('pageerror', (e) => thrown.push(e.message));
  const auth = session();
  await page.addInitScript((s) => {
    try { localStorage.setItem('wurm.auth', JSON.stringify(s)); } catch { /* none */ }
    // What the boot card showed, as it showed it, and when its first frame came.
    const seen = [];
    Object.defineProperty(window, '__boot', { value: { seen, gone: null, firstFrame: null } });
    // Held once found: the card is taken out of the page with the bar full, and its last width is still to be read.
    let bar = null;
    let now = null;
    const look = () => {
      bar ??= document.querySelector('#boot .boot-bar i');
      now ??= document.querySelector('#boot .boot-now span');
      if (!bar || !now) return;
      const w = parseFloat(bar.style.width || '0');
      const said = now.textContent ?? '';
      const last = seen[seen.length - 1];
      if (!last || last.w !== w || last.said !== said) seen.push({ t: performance.now(), w, said });
    };
    new MutationObserver(() => {
      look();
      if (window.__boot.firstFrame === null && document.readyState !== 'loading' && !document.getElementById('boot') && document.getElementById('game')) {
        window.__boot.gone ??= performance.now();
        requestAnimationFrame(() => { if (window.__boot.firstFrame === null) window.__boot.firstFrame = performance.now(); });
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  }, auth);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    if (url.origin !== KEEPER) return route.abort();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (isl.down) return route.abort('internetdisconnected');
    await new Promise((done) => setTimeout(done, LATENCY));
    const door = /\/rest\/v1\/rpc\/(\w+)/.exec(url.pathname)?.[1];
    if (isl.hold && door === isl.hold) await new Promise((done) => (isl.release = done));
    if (isl.down) return route.abort('internetdisconnected');
    const a = answer(isl, url, req.postData());
    debug(`${req.method()} ${url.pathname.replace('/rest/v1/', '')}`);
    return route.fulfill({ status: a.status, body: a.body, contentType: a.contentType, headers: CORS });
  });
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    debug(`socket ${isl.down ? 'refused' : 'opened'}`);
    if (isl.down) { ws.close({ code: 1011, reason: 'down' }); return; }
    isl.sockets.add(ws);
    ws.onClose(() => isl.sockets.delete(ws));
    ws.onMessage((raw) => {
      if (typeof raw !== 'string') return;
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (!Array.isArray(m)) return;
      const [joinRef, ref, topic, event] = m;
      if (event !== 'heartbeat') debug(`${event} ${topic}`);
      setTimeout(() => {
        if (isl.down || !isl.sockets.has(ws)) return;
        if (event === 'phx_join') ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: [] } }]));
        else if (event === 'heartbeat' || event === 'phx_leave' || event === 'access_token') ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
      }, LATENCY / 2);
    });
  });
  return { context, page, thrown };
}

const T0 = Date.now();
/** With `LOGIN_CHECK_DEBUG`, what the stand-in island is asked, as it is asked. */
const debug = (what) => { if (process.env.LOGIN_CHECK_DEBUG) console.log(`    ${String(Date.now() - T0).padStart(6)} ${what}`); };
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Ashore: navigation to first frame, and the bar on the way. */
async function ashore(browser, base) {
  const isl = makeIsland();
  const { context, page, thrown } = await openGame(browser, isl);
  await page.goto(`${base}/index.html`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__boot.firstFrame !== null, null, { timeout: 60_000 });
  const boot = await page.evaluate(() => ({
    ...window.__boot, phases: window.wurm?.boot ?? null,
    // When the last of the page's scripts had come in, and when the first word reached the boot card.
    scripts: Math.max(...performance.getEntriesByType('resource').filter((e) => /\.js(\?|$)/.test(e.name)).map((e) => e.responseEnd)),
  }));
  return { isl, context, page, thrown, boot };
}

/** Ashore again in the same browser, as somebody coming back tomorrow: what it kept (the trees' bakes) kept. */
async function again(page) {
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => window.__boot.firstFrame !== null, null, { timeout: 60_000 });
  return page.evaluate(() => ({ ...window.__boot, phases: window.wurm?.boot ?? null }));
}

/** Cut the network (or only the socket), change a tile, bring it back, and time it to playable. */
async function drop(page, isl, kind) {
  await page.waitForFunction(() => window.wurm?.island && !window.wurm.island.deaf(), null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const joinsBefore = isl.calls.get('rpc_join') ?? 0;
  const at = await page.evaluate(() => {
    const p = window.wurm.game.player;
    const x = Math.floor(p.x) + 2, y = Math.floor(p.y);
    return { x, y, tile: window.wurm.game.world.getTile(x, y) };
  });
  const tile = at.tile === 1 ? 4 : 1;
  if (kind === 'network') {
    isl.down = true;
    await page.context().setOffline(true);
  } else {
    isl.down = true;
  }
  debug(`${kind}: down`);
  for (const ws of [...isl.sockets]) await ws.close({ code: 1011, reason: 'dropped' }).catch(() => {});
  isl.sockets.clear();
  isl.changes.push({ n: isl.changes.length + 1, x: at.x, y: at.y, tile, data: 0, corners: null, soil: null });
  await page.waitForTimeout(kind === 'network' ? OUTAGE : 300);
  isl.down = false;
  // Start watching before the network is back, so nothing is missed between the two.
  const watching = page.evaluate(({ x, y, tile }) => new Promise((done) => {
    const from = performance.now();
    const got = {};
    const tick = () => {
      const t = performance.now() - from;
      const banner = document.querySelector('.reconnect-banner');
      if (got.joined === undefined && !window.wurm.island.deaf()) got.joined = t;
      if (got.laid === undefined && window.wurm.game.world.getTile(x, y) === tile) got.laid = t;
      if (got.bannerSeen === undefined && banner && !banner.hidden) got.bannerSeen = t;
      const quiet = !banner || banner.hidden;
      if (got.joined !== undefined && got.laid !== undefined && quiet) { got.playable = t; done(got); return; }
      if (t > 40_000) { done(got); return; }
      setTimeout(tick, 10);
    };
    tick();
  }), { ...at, tile });
  debug(`${kind}: back`);
  if (kind === 'network') await page.context().setOffline(false);
  const got = await watching;
  got.rejoined = (isl.calls.get('rpc_join') ?? 0) - joinsBefore;
  return got;
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(options);
const bad = [];
const runs = { ashore: [], again: [], network: [], socket: [] };
let lastBoot = null;
for (let r = 0; r < RUNS; r++) {
  const a = await ashore(browser, base);
  runs.ashore.push(a.boot.firstFrame);
  lastBoot = a.boot;
  const early = a.thrown.length;
  for (const t of a.thrown) bad.push(`ashore: threw ${t}`);
  runs.network.push(await drop(a.page, a.isl, 'network'));
  runs.socket.push(await drop(a.page, a.isl, 'socket'));
  for (const t of a.thrown.slice(early)) bad.push(`after a drop: threw ${t}`);
  const b = await again(a.page);
  runs.again.push(b.firstFrame);
  await a.context.close();
}

/** Screenshots of the loading screen, held on a door part way through the join. */
if (SHOTS) {
  mkdirSync(SHOTS, { recursive: true });
  for (const [name, view] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['phone', { viewport: { width: 390, height: 844 }, mobile: true }]]) {
    const isl = makeIsland();
    isl.hold = 'rpc_land_window';
    const { context, page } = await openGame(browser, isl, view);
    await page.goto(`${base}/index.html`, { waitUntil: 'commit' });
    await page.waitForFunction(() => document.querySelector('#boot .boot-done li'), null, { timeout: 60_000 }).catch(() => {});
    for (let i = 0; i < 100 && !isl.release; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(SHOTS, `loading-${name}.png`) });
    isl.release?.();
    await context.close();
  }
}
await browser.close();
server.close();

const ms = (v) => (v === undefined ? 'never' : `${Math.round(v)} ms`);
const pick = (k, f) => median(runs[k].map(f).filter((v) => v !== undefined)) ?? undefined;
console.log(`login check (${RUNS} run${RUNS > 1 ? 's' : ''}, ${LATENCY} ms a round trip):`);
console.log(`  ashore: first frame ${ms(median(runs.ashore))} from navigation; again in the same browser ${ms(median(runs.again))}`);
for (const k of ['network', 'socket']) {
  console.log(`  ${k} drop: joined ${ms(pick(k, (g) => g.joined))}, missed tile laid ${ms(pick(k, (g) => g.laid))}, playable ${ms(pick(k, (g) => g.playable))}`
    + `${k === 'network' ? ` after ${OUTAGE} ms down` : ''}; banner ${runs[k].some((g) => g.bannerSeen !== undefined) ? 'shown' : 'not shown'}; rejoined ${runs[k].map((g) => g.rejoined).join(',')}×`);
}
if (lastBoot) {
  const steps = [];
  for (const s of lastBoot.seen) if (!steps.length || steps[steps.length - 1].said !== s.said) steps.push(s);
  const first = lastBoot.seen.find((x) => !/Raising/.test(x.said));
  console.log(`  scripts in at ${Math.round(lastBoot.scripts)} ms, first phase said at ${Math.round(first?.t ?? 0)} ms, boot card gone at ${Math.round(lastBoot.gone ?? 0)} ms`);
  if (lastBoot.phases) console.log(`  phases: ${Object.entries(lastBoot.phases).map(([k, v]) => `${k} ${v} ms`).join(', ')}`);
  console.log(`  boot bar: ${steps.map((s, i) => `${s.said} ${Math.round(s.w)}%${i + 1 < steps.length ? ` (${Math.round(steps[i + 1].t - s.t)} ms)` : ''}`).join(' → ')}`);
}

if (!MEASURE) {
  const seen = lastBoot?.seen ?? [];
  for (let i = 1; i < seen.length; i++) {
    if (seen[i].w < seen[i - 1].w) { bad.push(`boot bar went back: ${seen[i - 1].w}% (${seen[i - 1].said}) to ${seen[i].w}% (${seen[i].said})`); break; }
  }
  if (!seen.length || seen[seen.length - 1].w < 100) bad.push(`boot bar did not fill: ended at ${seen[seen.length - 1]?.w ?? 0}%`);
  const order = seen.map((s) => PHASES.findIndex((p) => s.said === p || s.said.startsWith(`${p}:`))).filter((i) => i >= 0);
  for (let i = 1; i < order.length; i++) if (order[i] < order[i - 1]) { bad.push(`boot phases out of order: ${seen.map((s) => s.said).join(' | ')}`); break; }
  const missing = PHASES.filter((_, i) => !order.includes(i));
  if (!PHASES.length || missing.length) bad.push(`boot phases never shown: ${missing.join(', ') || 'none read from src/ui/bootsteps.ts'}`);
  for (const k of ['network', 'socket']) {
    for (const g of runs[k]) {
      if (g.playable === undefined) bad.push(`${k} drop: not playable within 40 s (${JSON.stringify(g)})`);
      else if (g.playable > RECONNECT_MOST) bad.push(`${k} drop: ${Math.round(g.playable)} ms to playable, more than ${RECONNECT_MOST} ms`);
      if (g.rejoined) bad.push(`${k} drop: joined the island again (${g.rejoined} rpc_join) rather than resuming`);
    }
  }
}
for (const b of bad) console.error(`  ${b}`);
if (bad.length) process.exit(1);
