/**
 * One device at a time on an account.
 *
 * Asked for: "Implement sign in gates to prevent signing into one account from two devices simultaneously". A game
 * tab sends its seat with every call (`x-wurm-seat`); every door starts with `private.pace`, and there
 * `private.seat_check` lets the seat's holder through and refuses another, "Playing on another device.", until the
 * seat goes unheard for `seat_stale` or Play here (`rpc_take_seat`) takes it.
 *
 * The island, through `rpc_move`: the first seat to call holds it; a second seat is refused, in those words; a call
 * with no seat (the account page) is not asked; Play here gives the seat to the second, and the first is refused;
 * a seat unheard past `seat_stale` is taken by whoever calls; a seat that is not one is refused as a bad request.
 * The browser: once a tab holds a seat, every call to a door carries it, and the same seat after a reload; before,
 * none.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { SEAT_STALE_S } from '../../src/net/supabase';

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

const U = 'a9c1e000-0000-4000-8000-0000000000c5';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.walk(w uuid, k text, seat text) returns void language plpgsql as $f$
declare r jsonb;
begin
  perform set_config('request.headers', case when seat is null then '{}' else json_build_object('x-wurm-seat', seat)::text end, true);
  begin
    r := rpc_move(w, 10.5, 10.5, 0);
    insert into pg_temp.said values (k, 'ok');
  exception when others then
    insert into pg_temp.said values (k, sqlstate || ' ' || sqlerrm);
  end;
end $f$;
do $t$
declare w uuid; u uuid := '${U}';
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Seats', 979, 40, 10, 10, true) returning id into w;
  perform land_blank(w, 40);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Twice');
  insert into said values ('STALE', extract(epoch from private.seat_stale())::int::text);

  perform pg_temp.walk(w, 'A_FIRST', '${A}');
  insert into said select 'HELD', seat::text from private.play_seat where uid = u;
  perform pg_temp.walk(w, 'B_SECOND', '${B}');
  perform pg_temp.walk(w, 'A_AGAIN', '${A}');
  perform pg_temp.walk(w, 'NONE', null);

  -- Play here, from B.
  perform set_config('request.headers', json_build_object('x-wurm-seat', '${B}')::text, true);
  insert into said values ('TAKE', rpc_take_seat()::text);
  insert into said select 'HELD_B', seat::text from private.play_seat where uid = u;
  perform pg_temp.walk(w, 'A_AFTER', '${A}');
  perform pg_temp.walk(w, 'B_AFTER', '${B}');

  -- B unheard past the stale time: A takes it by calling.
  update private.play_seat set seen_at = now() - private.seat_stale() - interval '1 second' where uid = u;
  perform pg_temp.walk(w, 'A_STALE', '${A}');
  insert into said select 'HELD_STALE', seat::text from private.play_seat where uid = u;

  perform pg_temp.walk(w, 'BAD', 'not-a-seat');
end $t$;
select k || '=' || v from said;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const REFUSED = 'WK423 Playing on another device.';

check('a seat unheard for the browser\'s SEAT_STALE_S seconds is free', at('STALE') === String(SEAT_STALE_S), at('STALE'));
check('the first seat to call holds it', at('A_FIRST') === 'ok' && at('HELD') === A, `${at('A_FIRST')} / ${at('HELD')}`);
check('a second seat is refused: "Playing on another device."', at('B_SECOND') === REFUSED, at('B_SECOND'));
check('the holder goes on', at('A_AGAIN') === 'ok', at('A_AGAIN'));
check('a call with no seat (the account page) is not asked', at('NONE') === 'ok', at('NONE'));
check('Play here gives the seat to the second', at('TAKE') === '{}' && at('HELD_B') === B, `${at('TAKE')} / ${at('HELD_B')}`);
check('and then the first is refused, the second goes on', at('A_AFTER') === REFUSED && at('B_AFTER') === 'ok', `${at('A_AFTER')} / ${at('B_AFTER')}`);
check('a seat unheard past the stale time is taken by whoever calls', at('A_STALE') === 'ok' && at('HELD_STALE') === A, `${at('A_STALE')} / ${at('HELD_STALE')}`);
check('a seat that is not one: a bad request', at('BAD').startsWith('22023'), at('BAD'));

/* ---- the browser: a game tab's calls carry its seat ---------------------------------------------------------- */

const store = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0,
} as Storage;
const sent: Array<string | null> = [];
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  sent.push(new Headers(init?.headers).get('x-wurm-seat'));
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;
const net = await import('../../src/net/supabase');
await net.watchedFetch('https://island.example/rest/v1/rpc/rpc_move', { method: 'POST' });
net.holdSeat();
const mine = net.heldSeat();
await net.watchedFetch('https://island.example/rest/v1/rpc/rpc_move', { method: 'POST' });
await net.watchedFetch('https://island.example/rest/v1/rpc/rpc_act', { method: 'POST', headers: { 'content-type': 'application/json' } });
check('browser: no seat sent before the tab holds one (the account page)', sent[0] === null, String(sent[0]));
check('browser: once held, every call to a door carries it', !!mine && sent[1] === mine && sent[2] === mine, `${mine} / ${sent.slice(1).join(', ')}`);
check('browser: kept for the tab, so a reload holds the same seat', store.get('wurm.seat') === mine, String(store.get('wurm.seat')));
let told = 0;
net.onElsewhere(() => { told++; });
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async () =>
  new Response(JSON.stringify({ code: 'WK423', message: net.SEAT_ELSEWHERE }), { status: 400, headers: { 'content-type': 'application/json' } })) as typeof fetch;
await net.watchedFetch('https://island.example/rest/v1/rpc/rpc_move', { method: 'POST' });
check('browser: a call refused for another device\'s seat tells the page', told === 1, String(told));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\none device at a time — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
