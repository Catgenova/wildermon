/**
 * The job in hand's × in the queue list: stop it, start the next.
 *
 * Asked for: "add an x to stop the current process and begin next in queue". Stop (`Game.cancelAction`,
 * `rpc_cancel`) puts down the job in hand and empties the queue behind it; the × (`Game.skipAction`, `rpc_skip`)
 * puts down the job in hand, every go left of it, and starts the next job waiting at once, the rest kept. What this
 * asks, on three jobs queued behind a job in hand with goes left:
 *
 *   * the browser's rules: the job in hand stops and its goes left go with it; the next job waiting is in hand at
 *     once with its own goes; the rest stay queued, in order; "Stopped <verb>." said; with nothing waiting, it only
 *     stops; Stop, by contrast, empties the queue; on an island the × is said to the island (`game.skip`) and
 *     nothing else is decided here;
 *   * the island (`20261120000088_stop_the_job_in_hand.sql`): the same, in the same words, the next job's clock
 *     started from now and its goes carried; a job waiting that cannot be done when its turn comes is told and put
 *     out of the line, and the one behind it started, as `settle` does; with nothing waiting, it only stops; the
 *     answer is the list as it now is; Stop empties the queue; the door is an account's, not a stranger's;
 *   * the window, in Chromium, in Runecut and Classic: the job in hand's row has one ×, the waiting rows' ×'s size
 *     and right edge, titled "Stop · next in queue" ("Stop" with nothing waiting); pressed by the mouse, Enter,
 *     Space and a tap it asks the island once, the next job comes into hand and the focus goes to its ×; with
 *     nothing waiting it stops and the list goes.
 *
 * The island half makes its own island and rolls it back. The window needs the built site at the root (`npm run
 * build`) and Chromium; without them it is skipped (failed, with `QUEUESTOP_STRICT`). With `QUEUESTOP_SHOTS` set to
 * a directory it saves the queue list there at twice the pixels, in Runecut.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { ACTION_BY_ID } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { seenOf, type SeenJob } from '../../src/game/jobqueue';
import type { QsState } from './queuestop-page';
import { psql, check, finish } from './harness';

const verb = (id: string): string => {
  const def = ACTION_BY_ID.get(id);
  if (!def) throw new Error(`no ${id}`);
  return def.verb;
};
const ids = (q: readonly SeenJob[]): string => q.map((j) => `${j.action}x${j.goes}`).join(',');

/* ---- The browser's rules ------------------------------------------------- */

const IN_HAND = 'make_planks';
const WAITING: SeenJob[] = [
  { action: 'make_shafts', goes: 2 },
  { action: 'make_log_crate', goes: 1 },
  { action: 'make_mallet', goes: 3 },
];

const lined = (): Game => {
  const g = Game.create(4242);
  g.skills.values.set('mind_logic', 60);
  g.player.stats.stamina = 1;
  const log = g.inventory.add('log', { count: 20, extra: 'Pine' });
  const asked = (id: string, goes: number): void => g.requestAction(ACTION_BY_ID.get(id)!, { kind: 'item', uid: log.uid }, goes);
  asked(IN_HAND, 58);
  for (const j of WAITING) asked(j.action, j.goes);
  // Two goes of the job in hand done: 56 of 58 left, as the window says it.
  if (g.action) g.action.left = 56;
  return g;
};
const last = (g: Game): string => g.log[g.log.length - 1]?.text ?? '';

{
  const g = lined();
  check('browser: a job in hand, 56 of 58 left, and three waiting', g.action?.def.id === IN_HAND && g.action.left === 56
    && ids(seenOf(g.queue)) === ids(WAITING), `${g.action?.def.id} ${g.action?.left} ${ids(seenOf(g.queue))}`);
  const was = g.action;
  g.skipAction();
  check('browser: × stops the job in hand', g.action !== was && g.action?.def.id !== IN_HAND);
  check('browser: and says so', g.log.some((l) => l.text === `Stopped ${verb(IN_HAND)}.`), g.log.slice(-3).map((l) => l.text).join(' | '));
  check('browser: its 56 goes left go with it, nowhere in the queue', !g.queue.some((j) => j.def.id === IN_HAND), ids(seenOf(g.queue)));
  check('browser: the next job waiting is in hand at once, with its own goes',
    g.action?.def.id === WAITING[0].action && g.action.left === WAITING[0].goes && g.action.goes === WAITING[0].goes && g.action.state === 'performing',
    `${g.action?.def.id} ${g.action?.left}/${g.action?.goes} ${g.action?.state}`);
  check('browser: the rest stay queued, in order', ids(seenOf(g.queue)) === ids(WAITING.slice(1)), ids(seenOf(g.queue)));
  g.skipAction();
  g.skipAction();
  check('browser: × twice more: the last in hand, nothing waiting', g.action?.def.id === WAITING[2].action && g.queue.length === 0,
    `${g.action?.def.id} ${g.queue.length}`);
  g.skipAction();
  check('browser: × with nothing waiting only stops', g.action === null && g.queue.length === 0 && last(g) === `Stopped ${verb(WAITING[2].action)}.`,
    `${g.action?.def.id} ${last(g)}`);
}
{
  const g = lined();
  g.cancelAction();
  check('browser: Stop, by contrast, puts down the job in hand and empties the queue', g.action === null && g.queue.length === 0
    && g.log.some((l) => l.text === 'Queue cleared: 3 actions.'), g.log.slice(-3).map((l) => l.text).join(' | '));
}
{
  // On an island: said to the island, and nothing else decided here until it answers.
  const g = lined();
  let skips = 0;
  let stops = 0;
  g.skip = () => skips++;
  g.stop = () => stops++;
  const n = g.log.length;
  g.skipAction();
  check('browser on an island: × is said to the island once, and Stop is not', skips === 1 && stops === 0, `${skips} ${stops}`);
  check('browser on an island: the job in hand put down here, the queue left for the island to say',
    g.action === null && ids(seenOf(g.queue)) === ids(WAITING) && g.log.length === n, `${g.action?.def.id} ${ids(seenOf(g.queue))}`);
  g.skipAction();
  check('browser on an island: nothing in hand, nothing said', skips === 1);
}

/* ---- The island ------------------------------------------------------------ */

const A = '7e5b0000-0000-4000-8000-0000000f5001';
const tileAt = (x: number, y: number): string => `{"kind":"tile","x":${x},"y":${y},"cx":${x},"cy":${y}}`;
// Three digs on tiles in reach, each with its own count, behind a dig of 58 with 56 left; and one out of reach.
const QUEUED = `[{"action":"dig","target":${tileAt(8, 8)},"goes":3},{"action":"dig","target":${tileAt(9, 8)},"goes":4},`
  + `{"action":"dig","target":${tileAt(8, 9)},"goes":5}]`;
const REFUSED_FIRST = `[{"action":"dig","target":${tileAt(14, 14)},"goes":2},{"action":"dig","target":${tileAt(9, 9)},"goes":6}]`;

const out = psql(`
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; a uuid := '${A}'; r jsonb; m bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Queuestop', 61, 16, 8, 8, true) returning id into w;
  perform land_blank(w, 16);
  perform land_set_height(w, i, j, 100) from generate_series(0, 16) i, generate_series(0, 16) j;
  perform land_set_tile(w, i, j, 0) from generate_series(0, 15) i, generate_series(0, 15) j;
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  perform rpc_join(w, 'Alder');
  update player set x = 8.5, y = 8.5, stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1'), body_at = now()
    where world_id = w and uid = a;
  insert into said select 'REFUSAL', coalesce(act_refusal(w, a, 'dig', '${tileAt(8, 8)}'::jsonb), 'none');

  -- In hand: a dig of 58, 56 left, an hour from its next go; three waiting.
  update player set act = 'dig', act_target = '${tileAt(7, 8)}'::jsonb, act_started = now(), act_ends = now() + interval '1 hour',
         act_left = 56, act_goes = 58, act_queue = '${QUEUED}'::jsonb
    where world_id = w and uid = a;
  m := (select coalesce(max(n), 0) from event where world_id = w);
  r := rpc_skip(w);
  insert into said values ('ANSWER', (r->>'stopped') || '|' || coalesce(r->>'was', '') || '|' || coalesce(r->>'next', '') || '|' || (r->'queue')::text);
  insert into said select 'HAND', coalesce(act, '') || '|' || coalesce(act_target->>'x', '') || ',' || coalesce(act_target->>'y', '')
      || '|' || coalesce(act_left::text, '') || '/' || coalesce(act_goes::text, '')
      || '|' || (abs(extract(epoch from act_started - now())) < 1)::text || '|' || (act_ends > now())::text
      || '|' || (act_ends < now() + interval '50 minutes')::text
    from player where world_id = w and uid = a;
  insert into said select 'QUEUE', coalesce(string_agg((q->>'action') || 'x' || (q->>'goes') || '@' || (q->'target'->>'x') || ',' || (q->'target'->>'y'), ',' order by o), '')
    from player, jsonb_array_elements(act_queue) with ordinality t(q, o) where world_id = w and uid = a;
  insert into said select 'SAID', string_agg(text, ' | ' order by n) from event where world_id = w and n > m and uid = a;

  -- Twice more: the last in hand, nothing waiting; and once more, which only stops.
  perform rpc_skip(w);
  perform rpc_skip(w);
  insert into said select 'LAST', coalesce(act, '') || '|' || coalesce(act_left::text, '') || '|' || jsonb_array_length(act_queue)
    from player where world_id = w and uid = a;
  m := (select coalesce(max(n), 0) from event where world_id = w);
  r := rpc_skip(w);
  insert into said values ('EMPTY', (r->>'stopped') || '|' || coalesce(r->>'next', '') || '|' || (r->'queue')::text);
  insert into said select 'EMPTY_HAND', coalesce(act, 'none') || '|' || jsonb_array_length(act_queue) from player where world_id = w and uid = a;
  insert into said select 'EMPTY_SAID', string_agg(text, ' | ' order by n) from event where world_id = w and n > m and uid = a;
  r := rpc_skip(w);
  insert into said values ('NOTHING', (r->>'stopped') || '|' || coalesce(r->>'next', '') || '|' || (r->'queue')::text);

  -- The first waiting cannot be done when its turn comes: told, put out, the one behind it started.
  update player set act = 'dig', act_target = '${tileAt(7, 8)}'::jsonb, act_started = now(), act_ends = now() + interval '1 hour',
         act_left = 4, act_goes = 4, act_queue = '${REFUSED_FIRST}'::jsonb
    where world_id = w and uid = a;
  m := (select coalesce(max(n), 0) from event where world_id = w);
  r := rpc_skip(w);
  insert into said select 'PAST', coalesce(act, '') || '|' || coalesce(act_target->>'x', '') || ',' || coalesce(act_target->>'y', '')
      || '|' || coalesce(act_left::text, '') || '|' || jsonb_array_length(act_queue)
    from player where world_id = w and uid = a;
  insert into said select 'PAST_SAID', string_agg(kind || ':' || text, ' | ' order by n) from event where world_id = w and n > m and uid = a;
  insert into said select 'PAST_WHY', coalesce(act_refusal(w, a, 'dig', '${tileAt(14, 14)}'::jsonb), 'none');

  -- Stop, by contrast: the job in hand and the queue both.
  update player set act = 'dig', act_target = '${tileAt(7, 8)}'::jsonb, act_started = now(), act_ends = now() + interval '1 hour',
         act_left = 56, act_goes = 58, act_queue = '${QUEUED}'::jsonb
    where world_id = w and uid = a;
  perform rpc_cancel(w);
  insert into said select 'CANCEL', coalesce(act, 'none') || '|' || jsonb_array_length(act_queue) from player where world_id = w and uid = a;
end $t$;
insert into said select 'DOOR', has_function_privilege('authenticated', 'rpc_skip(uuid)', 'execute')::text
  || '|' || has_function_privilege('anon', 'rpc_skip(uuid)', 'execute')::text;
select k || '=' || coalesce(v, '') from said;
rollback;
`);

const island = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const dig = verb('dig');
const Dig = `${dig[0].toUpperCase()}${dig.slice(1)}`;
check('island: the digs asked for can be done', island.get('REFUSAL') === 'none', island.get('REFUSAL'));
check('island: × answers what it stopped, what it started, and the list as it now is',
  island.get('ANSWER') === 'true|dig|dig|[{"goes": 4, "action": "dig"}, {"goes": 5, "action": "dig"}]', island.get('ANSWER'));
check('island: the next job waiting is in hand, its own goes, its clock started from now',
  island.get('HAND') === 'dig|8,8|3/3|true|true|true', island.get('HAND'));
check('island: the 56 goes left of the job stopped are dropped; the rest stay queued, in order, on their own tiles',
  island.get('QUEUE') === 'digx4@9,8,digx5@8,9', island.get('QUEUE'));
check('island: said as the browser says it: what stopped, then what started', island.get('SAID') === `Stopped ${dig}. | ${Dig}.`, island.get('SAID'));
check('island: × twice more: the last in hand, nothing waiting', island.get('LAST') === 'dig|5|0', island.get('LAST'));
check('island: × with nothing waiting only stops', island.get('EMPTY') === 'true||[]' && island.get('EMPTY_HAND') === 'none|0'
  && island.get('EMPTY_SAID') === `Stopped ${dig}.`, `${island.get('EMPTY')} ${island.get('EMPTY_HAND')} ${island.get('EMPTY_SAID')}`);
check('island: × with nothing in hand does nothing', island.get('NOTHING') === 'false||[]', island.get('NOTHING'));
check('island: a job waiting that cannot be done is told and put out, and the one behind it started',
  island.get('PAST') === 'dig|9,9|6|0' && island.get('PAST_SAID') === `info:Stopped ${dig}. | error:${island.get('PAST_WHY')} | info:${Dig}.`,
  `${island.get('PAST')} ${island.get('PAST_SAID')}`);
check('island: Stop, by contrast, empties the queue', island.get('CANCEL') === 'none|0', island.get('CANCEL'));
check('island: the door is an account\'s, not a stranger\'s', island.get('DOOR') === 'true|false', island.get('DOOR'));

/* ---- The window -------------------------------------------------------------- */

const ROOT = resolve('.');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };

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
  console.log('queuestop: no Chromium here (set CHROME_PATH), or no built site; the window is not drawn.');
  if (process.env.QUEUESTOP_STRICT) check('drawn: Chromium', false);
} else {
  const shots = process.env.QUEUESTOP_SHOTS;
  if (shots) mkdirSync(shots, { recursive: true });
  const made = new Map<string, string>();
  const head = readFileSync(join(ROOT, 'index.html'), 'utf8')
    .replace(/\s*<script type="module"[^>]*><\/script>/g, '')
    .replace(/\s*<link rel="modulepreload"[^>]*>/g, '');
  const bundled = await build({
    entryPoints: [join(ROOT, 'supabase/test/queuestop-page.ts')], bundle: true, format: 'esm', write: false, logLevel: 'error', target: 'es2022',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
  });
  made.set('__qs.js', bundled.outputFiles[0].text);
  made.set('__qs.html', head.replace('</body>', '<script type="module" src="./__qs.js"></script>\n</body>'));
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
    const tab: Page = await (await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
    await tab.goto(`${base}/__qs.html`, { waitUntil: 'load' });
    await tab.waitForFunction(() => !!(window as unknown as { qs?: unknown }).qs, null, { timeout: 60_000 });
    const call = <T>(f: string, ...args: unknown[]): Promise<T> =>
      tab.evaluate(([f, args]) => {
        const api = (window as unknown as { qs: Record<string, (...a: unknown[]) => unknown> }).qs;
        return api[f as string](...(args as unknown[]));
      }, [f, args] as const) as Promise<T>;
    type Box = { x: number; y: number; w: number; h: number };
    const boxes = (): Promise<{ stop: Box; drop: Box; panel: Box }> => call('boxes');
    const ways: Array<[string, () => Promise<void>]> = [
      ['the mouse', () => tab.click('.cq-now .cq-stop')],
      ['Enter', async () => {
        await tab.focus('.cq-now .cq-stop');
        await tab.keyboard.press('Enter');
      }],
      ['Space', async () => {
        await tab.focus('.cq-now .cq-stop');
        await tab.keyboard.press('Space');
      }],
      ['a tap', () => tab.tap('.cq-now .cq-stop')],
    ];
    for (const style of ['runecut', 'classic'] as const) {
      await call('look', style);
      const s0 = await call<QsState>('setup', 9);
      check(`${style}: the job in hand's row has one ×, titled "Stop · next in queue"`, s0.shown && s0.now === 'Blow a glass panel'
        && s0.nowButtons === 1 && s0.stop === 'Stop · next in queue' && s0.stopLabel === 'Stop · next in queue: blow a glass panel'
        && s0.title.includes('Action queue · 10/10'), JSON.stringify(s0));
      check(`${style}: the waiting rows keep ↑ ↓ ×`, s0.waitingButtons.join('') === '↑↓×', s0.waitingButtons.join(''));
      const b = await boxes();
      check(`${style}: the × the waiting rows' size, at their right edge`, b.stop.w > 0 && Math.abs(b.stop.w - b.drop.w) < 0.5
        && Math.abs(b.stop.h - b.drop.h) < 0.5 && Math.abs(b.stop.x + b.stop.w - (b.drop.x + b.drop.w)) < 0.5, JSON.stringify(b));
      if (shots && style === 'runecut') {
        const R = 12;
        await tab.screenshot({ path: join(shots, 'queue-stop-runecut.png'), clip: { x: b.panel.x - R, y: b.panel.y - R, width: b.panel.w + 2 * R, height: b.panel.h + 2 * R } });
      }
      for (const [how, press] of ways) {
        const before = await call<QsState>('setup', 3);
        await press();
        await call('wait', 500);
        const after = await call<QsState>('state');
        check(`${style}, ${how}: asked of the island once, Stop not; the next in hand, the rest still queued`,
          after.skips === 1 && after.stops === 0 && after.inHand === 'cut_grass' && after.left === 1
          && after.queued.length === before.queued.length - 1 && after.now === 'Cut grass', JSON.stringify(after));
        check(`${style}, ${how}: the focus on the next job's ×`, how === 'the mouse' || how === 'a tap' || after.focusOnStop, JSON.stringify(after));
      }
      // Down to nothing waiting: "Stop", and it only stops.
      await call<QsState>('setup', 1);
      await ways[0][1]();
      await call('wait', 500);
      const one = await call<QsState>('state');
      check(`${style}: one left, nothing waiting: its × titled "Stop"`, one.inHand === 'cut_grass' && one.queued.length === 0 && one.stop === 'Stop'
        && one.stopLabel === 'Stop: cut grass', JSON.stringify(one));
      await ways[0][1]();
      await call('wait', 500);
      const none = await call<QsState>('state');
      check(`${style}: × with nothing waiting: stopped, the list gone`, none.inHand === null && none.queued.length === 0 && !none.shown && none.skips === 2,
        JSON.stringify(none));
      // Stop on the bar, as before: everything.
      await call<QsState>('setup', 3);
      const all = await call<QsState>('stopAll');
      check(`${style}: Stop, by contrast, empties the queue`, all.inHand === null && all.queued.length === 0 && all.stops === 1 && all.skips === 0, JSON.stringify(all));
    }
    check('drawn: nothing thrown', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
    server.close();
  }
}

finish('the job in hand\'s × in the queue list');
