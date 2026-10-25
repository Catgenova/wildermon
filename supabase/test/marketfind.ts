/**
 * Finding things on the market.
 *
 * Asked for: "The stalls work, but finding things in them doesn't. Price
 * history (per item kind, from actual sales on the island), search across all
 * stalls on the island (what's for sale where, at what price/QL, with a
 * walk-to/map-pin action), buy orders players can post, and a market map
 * pin."
 *
 * The island half, through the doors, on the suite's Hoarding with Dane and
 * people new to it:
 *
 *   * a thing bought off a stall is written down with its quality, and what
 *     is brought to a buy order with the quality of what went, poorest first,
 *     averaged by the unit;
 *   * `rpc_prices` hands back a day's average quality, null where none of its
 *     sales says one;
 *   * `rpc_sales` hands back a thing's last `sales_shown()` sales of the
 *     month, newest first, with when, how many, the silver and the quality;
 *     nothing from before the month, nothing for an id longer than any, and
 *     nothing to somebody not on the island;
 *   * away from the board, `rpc_market` names the nearest settlement token,
 *     and at the board it names none;
 *   * `rpc_sales` is paced as a read, and the browser's numbers are the
 *     island's (`SALES_SHOWN`, `SALE_DAYS`).
 *
 * The browser half: finding (`marketfind.ts`) in the rules' own terms, and the
 * Market window drawn in Chromium on the page `market-page.ts` builds -- four
 * stalls, a shop counter, two orders and a month of sales:
 *
 *   * Find lists every priced thing on every stall but your own that answers
 *     what is typed, one row each, with its quality, its price of one and that
 *     against the month's average; sorted by the price of one, by quality, by
 *     distance;
 *   * Walk sets off for the stall; Pin puts a market mark on the map, once;
 *     within reach of the counter the row's button is Buy, and asks `rpc_buy`;
 *   * away from the board the last board read is still found in, with the
 *     nearest token to walk to, and an order is not offered to be filled;
 *   * History asks `rpc_sales` and lists what it says; Order fills the order
 *     form with the kind and its average price;
 *   * the map is handed every stall on the board;
 *   * and on a phone nothing runs off the side of the window.
 *
 * The island half runs against the database the suite leaves behind, in a
 * transaction that is rolled back. The Chromium half needs a Chromium (as
 * `care.ts` finds one); with none it says so and passes, unless
 * `CROWD_STRICT` is set.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { againstAverage, againstWords, answers, offersFor, type FindStall } from '../../src/game/marketfind';
import { SALE_DAYS, SALES_SHOWN, saleLine, summarise, type SaleDay } from '../../src/game/prices';
import { MARKET_MARK } from '../../src/game/marks';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/* ---- the island ------------------------------------------------------------- */
console.log('--- the island');
const BRYN = 'd5d5d5d5-d5d5-4d5d-8d5d-d5d5d5d5d5d5';
const FENNA = 'd6d6d6d6-d6d6-4d6d-8d6d-d6d6d6d6d6d6';
const STRAY = 'd7d7d7d7-d7d7-4d7d-8d7d-d7d7d7d7d7d7';
const isle = psql(`
begin;
create temp table said (k text, v text);
do $b$
declare w uuid; dane uuid; ax double precision; ay double precision; tx int; ty int; ox double precision;
        bryn uuid := '${BRYN}'; fenna uuid := '${FENNA}';
        v_stall bigint; v_pair bigint; v_o bigint; v_got jsonb; i int;
begin
  select id into w from world where name = 'Hoarding';
  select uid, x, y into dane, ax, ay from player where world_id = w and name = 'Dane';
  tx := floor(ax)::int; ty := floor(ay)::int;
  -- Twenty tiles off, towards the middle, whatever ran before left Dane.
  ox := case when ax < (select size from world where id = w) / 2 then ax + 20 else ax - 20 end;
  update player set act = null, act_queue = '[]'::jsonb, away = false where world_id = w and uid = dane;
  -- A month with nothing sold in it yet.
  delete from sale where world_id = w;
  insert into player (world_id, uid, name, x, y) values (w, bryn, 'Bryn', ax, ay);
  perform give_coins(w, bryn, 100);
  perform give_coins(w, dane, 100);
  delete from caller where uid in (dane, bryn);

  -- Dane's stall at his feet, two planks of QL 30 on it for 6 silver, and a mailbox: the board.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, made_by)
    values (w, 'furniture', 'stall', tx, ty, 0, 0, tx + 0.5, ty + 0.5, dane) returning id into v_stall;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, made_by)
    values (w, 'furniture', 'mailbox', tx, ty, 2, 2, tx + 0.75, ty + 0.75, dane);
  insert into item (world_id, holder, def, ql, count, placed, price)
    values (w, 'furniture', 'plank', 30, 2, v_stall, 6) returning id into v_pair;

  -- Bryn buys them.
  perform set_config('request.jwt.claims', json_build_object('sub', bryn)::text, true);
  insert into said values ('BUY', coalesce(rpc_buy(w, v_pair)->>'paid', 'refused'));
  insert into said values ('PLANKSALE', (select count || ',' || silver || ',' || ql from sale where world_id = w and def = 'plank'));

  -- Dane wants three iron ore of QL 10 or better at 4 each; Bryn brings them out of stacks of QL 20 (two) and QL 50 (five).
  perform set_config('request.jwt.claims', json_build_object('sub', dane)::text, true);
  v_o := (rpc_order(w, 'iron_ore', 3, 4, 10)->>'order')::bigint;
  perform set_config('request.jwt.claims', json_build_object('sub', bryn)::text, true);
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', bryn, 'iron_ore', 20, 2), (w, 'player', bryn, 'iron_ore', 50, 5);
  insert into said values ('FILL', coalesce(rpc_order_fill(w, v_o, 3)->>'paid', 'refused'));
  insert into said values ('ORESALE', (select count || ',' || silver || ',' || ql from sale where world_id = w and def = 'iron_ore'));

  -- One from before quality was written down, three days ago; and one from before the month.
  insert into sale (world_id, def, count, silver, at) values (w, 'iron_ore', 4, 8, now() - interval '3 days');
  insert into sale (world_id, def, count, silver, ql, at) values (w, 'iron_ore', 9, 90, 70, now() - make_interval(days => sale_days() + 2));

  v_got := rpc_prices(w)->'sold';
  insert into said values ('PRICEPLANK', (v_got->'plank'->0->>'ql'));
  insert into said values ('PRICEORE', (select string_agg((d->>'ago') || ':' || coalesce(d->>'ql', 'null'), ' ' order by (d->>'ago')::int)
    from jsonb_array_elements(v_got->'iron_ore') d));

  v_got := rpc_sales(w, 'iron_ore');
  insert into said values ('SALES', (select string_agg((s->>'n') || ',' || (s->>'silver') || ',' || coalesce(s->>'ql', 'null'), ' ')
    from jsonb_array_elements(v_got->'sales') s));
  insert into said values ('AGO', (select ((v_got->'sales'->0->>'ago')::bigint < 60)::text || ',' || ((v_got->'sales'->1->>'ago')::bigint between 3 * 86400 - 60 and 3 * 86400 + 60)::text));
  for i in 1 .. 15 loop perform note_sale(w, 'rope', 1, i, 25); end loop;
  insert into said values ('SHOWN', jsonb_array_length(rpc_sales(w, 'rope')->'sales') || ',' || sales_shown()
    || ',' || (rpc_sales(w, 'rope')->'sales'->0->>'silver'));
  insert into said values ('LONG', jsonb_array_length(rpc_sales(w, repeat('x', 100))->'sales')::text);
  insert into said values ('NONE', jsonb_array_length(rpc_sales(w, 'pickaxe')->'sales')::text);

  -- A settlement of Fenna's, ten tiles from where Bryn will stand away from the board.
  insert into player (world_id, uid, name, x, y) values (w, fenna, 'Fenna', ox, ay);
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Findhold', floor(ox)::int, floor(ay)::int + 10, 3, 1, fenna);
  v_got := rpc_market(w);
  insert into said values ('ATBOARD', (v_got->>'board') || ',' || coalesce(v_got->>'token', 'none'));
  update player set body_at = now(), x = ox where world_id = w and uid = bryn;
  v_got := rpc_market(w);
  insert into said values ('AWAY', (v_got->>'board') || ',' || coalesce(v_got->'token'->>'deed', 'none'));
  insert into said values ('NEAREST', (select name from deed d where d.world_id = w
    order by (d.x + 0.5 - ox) ^ 2 + (d.y + 0.5 - ay) ^ 2 limit 1) || ',' || (v_got->'token'->>'x') || ',' || (v_got->'token'->>'y')
    || ',' || floor(ox)::int || ',' || (floor(ay)::int + 10));
  insert into said values ('PACE', private.pace_class('rpc_sales'));
  insert into said values ('DAYS', sale_days()::text);
end $b$;
select k || '|' || coalesce(v, 'null') from said;
rollback;
`);
const said = (key: string): string => isle.split('\n').find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? '';

check('a thing is bought off a stall', said('BUY') === '6', said('BUY'));
check('and its sale is written down with its quality', said('PLANKSALE') === '2,6,30', said('PLANKSALE'));
check('an order is filled', said('FILL') === '12', said('FILL'));
check('and its sale is written down with the quality of what went, poorest first, by the unit: (20 + 20 + 50) / 3',
  said('ORESALE') === '3,12,30', said('ORESALE'));
check('rpc_prices: a day\'s average quality', said('PRICEPLANK') === '30', said('PRICEPLANK'));
check('and null on a day none of whose sales says one; nothing from before the month', said('PRICEORE') === '0:30 3:null', said('PRICEORE'));
check('rpc_sales: newest first, with how many, the silver and the quality; nothing from before the month',
  said('SALES') === '3,12,30 4,8,null', said('SALES'));
check('and how long ago, in seconds', said('AGO') === 'true,true', said('AGO'));
check(`at most sales_shown(), the newest: ${SALES_SHOWN}`, said('SHOWN') === `${SALES_SHOWN},${SALES_SHOWN},15`, said('SHOWN'));
check('nothing for an id longer than any kind\'s, or for a kind never sold', said('LONG') === '0' && said('NONE') === '0',
  `${said('LONG')} ${said('NONE')}`);
check('at the board no token is named', said('ATBOARD') === 'true,none', said('ATBOARD'));
check('away from it the nearest settlement token is', said('AWAY') === 'false,Findhold', said('AWAY'));
{
  const [name, x, y, wx, wy] = said('NEAREST').split(',');
  check('the nearest of every settlement on the island, at its token\'s tile', name === 'Findhold' && x === wx && y === wy, said('NEAREST'));
}
check('rpc_sales is paced as a read', said('PACE') === 'look', said('PACE'));
check('the browser keeps the island\'s month', said('DAYS') === String(SALE_DAYS), said('DAYS'));
let stray = '';
try {
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PGHOST: process.env.PGHOST ?? '/var/run/postgresql', PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm', PGDATABASE: process.env.PGDATABASE ?? 'postgres' },
    input: `begin; select set_config('request.jwt.claims', json_build_object('sub', '${STRAY}')::text, true);
    select rpc_sales((select id from world where name = 'Hoarding'), 'iron_ore'); rollback;`,
  });
} catch (e) {
  stray = String((e as { stderr?: string }).stderr ?? e);
}
check('nobody not on the island reads its sales', stray.includes('you are not on this island'), stray.split('\n')[0]);

/* ---- the browser: the rules -------------------------------------------------- */
console.log('--- the browser');
{
  const me = { x: 100.5, y: 100.5 };
  const g = (id: number, def: string, ql: number, count: number, price: number | null) => ({ id, def, ql, count, extra: null, price });
  const stalls: FindStall[] = [
    { id: 1, x: 110, y: 100, owner: 'Ama', mine: false, deed: null, goods: [g(1, 'iron_ore', 34, 5, 15), g(2, 'plank', 40, 1, 4)] },
    { id: 2, x: 70, y: 120, owner: 'Bryn', mine: false, deed: null, what: 'counter', goods: [g(3, 'iron_ore', 22, 10, 20), g(4, 'iron_lump', 45, 2, 18)] },
    { id: 3, x: 190, y: 160, owner: 'Cato', mine: false, deed: null, goods: [g(5, 'iron_ore', 61, 3, 18), g(6, 'iron_ore', 70, 1, null)] },
    { id: 4, x: 101, y: 100, owner: 'You', mine: true, deed: null, goods: [g(7, 'iron_ore', 90, 1, 1)] },
  ];
  const ids = (sort: 'each' | 'ql' | 'near'): string => offersFor(stalls, 'iron ore', me, sort).map((o) => o.good.id).join(',');
  check('found: every priced thing that answers, on every stall but your own, by the price of one', ids('each') === '3,1,5', ids('each'));
  check('by quality, best first', ids('ql') === '5,1,3', ids('ql'));
  check('by distance, nearest first', ids('near') === '1,3,5', ids('near'));
  check('the price of one is the stack\'s over its count', offersFor(stalls, 'iron ore', me, 'each')[0].each === 2);
  check('every word typed, in the name or the id, any case', answers('iron_lump', null, 'LUMP iron') && !answers('iron_lump', null, 'ore')
    && answers('plank', 'oak', 'oak plank') && !answers('plank', null, ''));
  check('against the month\'s average', againstAverage(2, 3.1) === -35 && againstWords(-35) === '35% under avg'
    && againstWords(againstAverage(6, 3.1)) === '94% over avg' && againstWords(againstAverage(3, 3)) === 'at avg'
    && againstAverage(3, null) === null && againstWords(null) === '');
  const days: SaleDay[] = [{ ago: 0, n: 6, silver: 21, lo: 3, hi: 4, ql: 31 }, { ago: 2, n: 10, silver: 25, lo: 2, hi: 3, ql: 24 },
    { ago: 5, n: 4, silver: 16, lo: 4, hi: 4, ql: null }];
  const s = summarise(days);
  check('a month\'s average quality by the unit, over the days that say it', !!s && Math.abs((s.ql ?? 0) - (31 * 6 + 24 * 10) / 16) < 1e-9,
    String(s?.ql));
  check('a sale as the history lists it', saleLine({ ago: 3 * 3600, n: 4, silver: 13, ql: 28 }) === '3 h ago · 4 sold · QL 28 · 3.3 silver each'
    && saleLine({ ago: 2 * 86400, n: 1, silver: 5, ql: null }) === '2 days ago · 1 sold · 5 silver each',
    saleLine({ ago: 3 * 3600, n: 4, silver: 13, ql: 28 }));
}

/* ---- the browser: the window, in Chromium ------------------------------------ */
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

type Hit = { what: string; cost: string; where: string; vs: string; acts: string[] };
interface Market {
  asked: Array<{ door: string; args: unknown[] }>;
  state: { board: boolean };
  cx: number;
  cy: number;
  open: () => Promise<void>;
  tab: (label: string) => Promise<boolean>;
  find: (text: string) => Promise<boolean>;
  sortBy: (v: string) => Promise<void>;
  hits: () => Hit[];
  press: (n: number, label: string) => Promise<boolean>;
  pressAny: (label: string) => Promise<boolean>;
  text: () => string;
  layout: () => { overflow: number; outside: string[] };
  reset: (board?: boolean) => Promise<void>;
  run: (ms: number) => void;
  settle: () => Promise<void>;
  marks: () => Array<{ name: string; x: number; y: number; colour: string }>;
  travelling: () => { x: number; y: number; name: string } | null;
  game: { putBody: (x: number, y: number, h: number) => void };
  ui: { minimap: { stalls: () => Array<{ x: number; y: number; mine: boolean }> } };
}
const market = <T>(tab: Page, fn: (m: Market, arg: unknown) => T | Promise<T>, arg?: unknown): Promise<T> =>
  tab.evaluate(([f, a]) => (new Function('m', 'a', `return (${f})(m, a)`))((window as unknown as { market: Market }).market, a), [fn.toString(), arg] as const) as Promise<T>;

const options = browserOptions();
if (!options) {
  console.log('marketfind: no Chromium here (set CHROME_PATH), so the window was not drawn.');
  if (process.env.CROWD_STRICT) check('a Chromium to draw the window in', false);
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/market-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const script = bundled.outputFiles[0].text;
  const css = ['src/style.css', 'src/phone.css'].map((f) => readFileSync(resolve(f), 'utf8')).join('\n');
  const browser = await chromium.launch(options);
  const open = async (phone: boolean): Promise<{ tab: Page; thrown: string[]; close: () => Promise<void> }> => {
    const ctx = await browser.newContext(phone
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addStyleTag({ content: css });
    await tab.addScriptTag({ content: `(() => {
      let t = performance.now();
      const d0 = Date.now() - t;
      performance.now = () => t;
      Date.now = () => d0 + t;
      window.driven = { tick: (ms) => { t += ms; } };
    })();` });
    await tab.addScriptTag({ content: script });
    return { tab, thrown, close: () => ctx.close() };
  };
  try {
    const { tab, thrown, close } = await open(false);
    await market(tab, (m) => m.open());
    check('the window asks the board, the orders and the month\'s prices', await market(tab, (m) =>
      ['rpc_market', 'rpc_orders', 'rpc_prices'].every((d) => m.asked.some((a) => a.door === d))));
    const typed = await market(tab, (m) => m.find('iron ore'));
    const hits = await market(tab, (m) => m.hits());
    check('Find: a box on the Board', typed);
    check('one row a priced thing on every stall but your own, by the price of one',
      hits.map((h) => h.what).join(' | ') === '10 × Iron ore, QL 22 | 5 × Iron ore, QL 34 | 3 × Iron ore, QL 61',
      hits.map((h) => h.what).join(' | '));
    check('each with its price of one and that against the month\'s average',
      hits.map((h) => h.cost.replace(h.vs, '')).join(' | ') === '2 silver each | 3 silver each | 6 silver each'
        && hits.map((h) => h.vs).join(' | ') === [2, 3, 6].map((e) => againstWords(againstAverage(e, 133 / 43))).join(' | '),
      hits.map((h) => `${h.cost}`).join(' | '));
    check('and where: whose, the tile, the settlement, how far', /^Bryn's shop counter · \d+,\d+ on Stonehaven · \d+ tiles · 2 gold for 10$/.test(hits[0]?.where ?? ''),
      hits[0]?.where);
    check('Walk and Pin on a stall out of reach', hits.every((h) => h.acts.join(',') === 'Walk,Pin'), hits.map((h) => h.acts.join(',')).join(' | '));
    await market(tab, (m) => m.sortBy('ql'));
    check('sorted by quality', (await market(tab, (m) => m.hits())).map((h) => h.what.split('QL ')[1]).join(',') === '61,34,22');
    await market(tab, (m) => m.sortBy('near'));
    check('sorted by distance', (await market(tab, (m) => m.hits()))[0]?.where.startsWith('Ama\'s stall'));
    check('the orders that want it, under it', await market(tab, (m) => m.text().includes('16 × iron ore of quality 30 or better at 4 silver each')));

    // Pin, once.
    await market(tab, (m) => m.press(0, 'Pin'));
    await market(tab, (m) => m.press(0, 'Pinned'));
    const marks = await market(tab, (m) => m.marks());
    const cx = await market(tab, (m) => m.cx);
    const cy = await market(tab, (m) => m.cy);
    check('Pin: a mark in the market colour at the stall, once', marks.length === 1 && marks[0].colour === MARKET_MARK
      && marks[0].name === 'Ama\'s stall' && marks[0].x === cx + 12 && marks[0].y === cy - 4, JSON.stringify(marks));
    check('and the row says Pinned', (await market(tab, (m) => m.hits()))[0]?.acts.join(',') === 'Walk,Pinned');
    // Walk.
    await market(tab, (m) => m.press(0, 'Walk'));
    const going = await market(tab, (m) => m.travelling());
    check('Walk: sets off for the stall', !!going && going.x === cx + 12 && going.y === cy - 4 && going.name === 'Ama\'s stall', JSON.stringify(going));
    // At the counter: Buy.
    await market(tab, (m, a) => {
      const [x, y] = a as [number, number];
      m.game.putBody(x + 0.5, y + 1.5, 0);
      return m.settle();
    }, [cx + 12, cy - 4]);
    await market(tab, (m) => m.find('iron ore'));
    const near = (await market(tab, (m) => m.hits()))[0];
    check('within reach of its counter, the row\'s button is Buy', near?.acts.join(',') === 'Buy,Pinned', near?.acts.join(','));
    await market(tab, (m) => m.press(0, 'Buy'));
    check('and Buy asks rpc_buy for that thing', await market(tab, (m) => m.asked.some((a) => a.door === 'rpc_buy' && a.args[0] === 902)),
      JSON.stringify(await market(tab, (m) => m.asked.filter((a) => a.door === 'rpc_buy'))));

    // History and Order.
    await market(tab, (m) => m.pressAny('History'));
    const lines = await market(tab, (m) => [...document.querySelectorAll('.market-sales div')].map((e) => e.textContent ?? ''));
    check('History asks rpc_sales for the kind and lists what it says', await market(tab, (m) => m.asked.some((a) => a.door === 'rpc_sales' && a.args[0] === 'iron_ore'))
      && lines.length === 5 && lines[0] === saleLine({ ago: 3600, n: 2, silver: 8, ql: 36 }), lines.join(' / '));
    await market(tab, (m) => m.pressAny('Order'));
    const form = await market(tab, () => ({
      kind: (document.querySelector('.market-kind') as HTMLInputElement | null)?.value,
      boxes: [...document.querySelectorAll<HTMLInputElement>('.market-order .market-count')].map((b) => b.value),
      held: document.querySelector('.market-order ~ .market-note')?.textContent ?? '',
    }));
    check('Order: the order form for the kind, at its average price of one', form.kind === 'Iron ore' && form.boxes.join(',') === '0,1,3'
      && form.held.includes(`Iron ore, ${SALE_DAYS} days: 43 sold`), JSON.stringify(form));

    // The Prices tab, narrowed.
    await market(tab, (m) => m.tab('Prices'));
    await market(tab, (m) => m.find('plank'));
    const rows = await market(tab, () => [...document.querySelectorAll<HTMLElement>('.market-page .price-row')].map((r) => r.dataset.def));
    check('Prices: narrowed by Find', rows.join(',') === 'plank', rows.join(','));

    // The map.
    const pins = await market(tab, (m) => m.ui.minimap.stalls());
    check('the map is handed every stall on the board, and your own', pins.length === 5 && pins.filter((p) => p.mine).length === 1, JSON.stringify(pins));

    // Away from the board.
    await market(tab, (m) => m.reset(false));
    await market(tab, (m) => m.tab('Board'));
    await market(tab, (m) => m.run(6000));
    await market(tab, (m) => m.settle());
    await market(tab, (m) => m.find('iron ore'));
    const away = await market(tab, (m) => ({ text: m.text(), hits: m.hits().length }));
    check('away from the board: the last board read, still found in', away.hits === 3 && /Board read .* ago\. Live at a settlement totem or mailbox\./.test(away.text),
      away.text.slice(0, 200));
    check('the nearest token, to walk to', away.text.includes('Nearest totem: Fernhollow'));
    const fills = await market(tab, () => [...document.querySelectorAll('.market-page button')].filter((b) => b.textContent === 'Fill').length);
    check('and no order offered to be filled', fills === 0 && away.text.includes('Fill at a totem or mailbox'), `${fills} Fill`);
    if (process.env.MARKET_SHOTS) await tab.screenshot({ path: `${process.env.MARKET_SHOTS}/marketfind-desktop.png` });
    if (thrown.length) check('and the page threw nothing', false, thrown.join('; '));
    await close();

    const p = await open(true);
    await market(p.tab, (m) => m.open());
    await market(p.tab, (m) => m.find('iron ore'));
    const lay = await market(p.tab, (m) => m.layout());
    check('on a phone, nothing runs off the side of the window', lay.overflow <= 0 && lay.outside.length === 0, JSON.stringify(lay));
    if (p.thrown.length) check('and the phone page threw nothing', false, p.thrown.join('; '));
    await p.close();
  } finally {
    await browser.close();
  }
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(bad.length ? `\n${bad.length} wrong` : `\nfinding things on the market — ${ok.length} of ${ok.length}`);
process.exit(bad.length ? 1 : 0);
