/**
 * An action taken once, however many times it is sent.
 *
 * Every call the browser makes to a door carries a key in `x-wurm-once` (`watchedFetch`), the same key
 * again when it is tried again, and the island takes a key once (`private.once`). What this asks:
 *
 * The browser, with a stand-in network:
 *   * every call to a door carries a key, a fresh one a call;
 *   * a call the network drops, or the gateway answers 502/503/504 for, is tried again with its own key;
 *   * a key the island has already taken comes back as an empty success, so nothing is said;
 *   * a call that is not to a door carries no key and is not tried again.
 *
 * The island, in a transaction rolled back:
 *   * an order put up twice with one key holds its silver once, and with two keys twice;
 *   * a dig asked twice with one key is one job, and run out comes to one go's dirt;
 *   * the repeat is refused with SQLSTATE WK409, and nothing it did stays;
 *   * a key whose call rolled back is free again, and one past the window is taken afresh;
 *   * a door run from inside another takes its call's key once (`rpc_parcel` runs `rpc_letter`);
 *   * a door that only reads keeps no key; a call with no key is not counted; a key that is not one is refused;
 *   * the sweep lets go of keys past the window, and every door that changes something takes a key.
 */
import { execFileSync } from 'node:child_process';
import { ONCE_HEADER, ONCE_RETRIES, ONCE_TAKEN, watchedFetch } from '../../src/net/supabase';

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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---- the browser ---------------------------------------------------------------------------------- */

const REST = 'https://island.example/rest/v1/';
/** What the stand-in network does with each try, in order; and the key each try carried. */
let answers: Array<() => Response> = [];
let keys: Array<string | null> = [];
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  keys.push(new Headers(init?.headers).get(ONCE_HEADER));
  const next = answers.shift();
  if (!next) throw new TypeError('no answer left');
  return next();
}) as typeof fetch;
const dropped = (): Response => { throw new TypeError('Failed to fetch'); };
const fine = (): Response => new Response('{"done":true}', { status: 200, headers: { 'content-type': 'application/json' } });
const gateway = (): Response => new Response('upstream gone', { status: 503 });
const taken = (): Response =>
  new Response(JSON.stringify({ code: ONCE_TAKEN, message: 'once: already taken' }), { status: 400 });
const refused = (): Response =>
  new Response(JSON.stringify({ code: 'P0001', message: 'You are too far away from that.' }), { status: 400 });
const call = (path: string, init: RequestInit = { method: 'POST', body: '{}' }): Promise<Response> =>
  watchedFetch(`${REST}${path}`, init);

answers = [fine, fine];
keys = [];
await call('rpc/rpc_act');
await call('rpc/rpc_act');
check('every call to a door carries a key', keys.length === 2 && keys.every((k) => k !== null && UUID.test(k)), keys.join(', '));
check('a fresh one a call', keys[0] !== keys[1], keys.join(', '));

answers = [dropped, fine];
keys = [];
const started = Date.now();
const again = await call('rpc/rpc_order');
check('a call the network drops is tried again, with the key it was sent with',
  again.status === 200 && keys.length === 2 && keys[0] === keys[1] && keys[0] !== null, keys.join(', '));
check(`after the first wait (${ONCE_RETRIES[0]} ms)`, Date.now() - started >= ONCE_RETRIES[0] - 20, `${Date.now() - started} ms`);

answers = [gateway, dropped, fine];
keys = [];
const third = await call('rpc/rpc_buy');
check('a gateway answer and a drop: tried twice more, all three with one key',
  third.status === 200 && keys.length === 3 && new Set(keys).size === 1, keys.join(', '));

answers = [dropped, dropped, dropped];
keys = [];
let threw = '';
try { await call('rpc/rpc_buy'); } catch (err) { threw = (err as Error).message; }
check(`dropped every time: tried ${ONCE_RETRIES.length + 1} times, then the network's error`,
  keys.length === ONCE_RETRIES.length + 1 && threw === 'Failed to fetch', `${keys.length} tries, ${threw}`);

answers = [dropped, taken];
keys = [];
const quiet = await call('rpc/rpc_act');
const quietBody = await quiet.text();
check('a retry the island had already done answers as an empty success: nothing to say',
  quiet.status === 200 && quietBody === '{}' && keys[0] === keys[1], `${quiet.status} ${quietBody}`);

answers = [refused];
keys = [];
const rule = await call('rpc/rpc_act');
check('a refusal by a rule is not tried again and comes back as the island said it',
  rule.status === 400 && keys.length === 1 && ((await rule.json()) as { message?: string }).message === 'You are too far away from that.');

answers = [fine];
keys = [];
await call('rest-of-it/item?select=*', { method: 'GET' });
check('a call that is not to a door carries no key', keys.length === 1 && keys[0] === null, keys.join(', '));
answers = [dropped];
keys = [];
threw = '';
try { await call('rest-of-it/item?select=*', { method: 'GET' }); } catch (err) { threw = (err as Error).message; }
check('and is not tried again', keys.length === 1 && threw === 'Failed to fetch', `${keys.length} tries`);

/* ---- the island ----------------------------------------------------------------------------------- */

const ME = 'a0c00000-0000-4000-8000-0000000000a1';
const OTHER = 'a0c00000-0000-4000-8000-0000000000a2';
const K1 = '0a1c0000-0000-4000-8000-000000000001';
const K2 = '0a1c0000-0000-4000-8000-000000000002';
const K3 = '0a1c0000-0000-4000-8000-000000000003';
const K4 = '0a1c0000-0000-4000-8000-000000000004';
const K5 = '0a1c0000-0000-4000-8000-000000000005';
const K6 = '0a1c0000-0000-4000-8000-000000000006';

const out = psql(`
begin;
create temp table said (k text, v text);
-- One request as PostgREST hands it on: its key in the headers, and nothing of the request before it.
create function pg_temp.req(p_key text) returns void language plpgsql as $f$
begin
  perform set_config('request.headers', case when p_key is null then '{"x-forwarded-for": "203.0.113.9"}'
                                             else json_build_object('x-wurm-once', p_key)::text end, true);
  perform set_config('wurm.once', '', true);
end $f$;
do $t$
declare w uuid; me uuid := '${ME}'; v_err text; v_n int;
  -- A call as PostgREST makes it: who, and the key in the headers it hands on.
  v_as text := json_build_object('sub', me)::text;
begin
  delete from private.once_key where uid = me;
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Oncehold', 193, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform set_config('request.jwt.claims', v_as, true);
  perform rpc_join(w, 'Onny');
  update player set stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1'), body_at = now()
   where world_id = w and uid = me;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Oncehold', 16, 16, 5, 1, me);
  delete from item where world_id = w and holder_uid = me;
  perform give_coins(w, me, 100);
  perform give(w, me, 'shovel', 1, 50, null, null, null, null, null);

  -- An order put up: 2 logs at 5 silver, 10 held. The same key again; then another key.
  perform pg_temp.req('${K1}');
  perform rpc_order(w, 'log', 2, 5);
  begin
    perform pg_temp.req('${K1}');
    perform rpc_order(w, 'log', 2, 5);
    v_err := 'went through';
  exception when others then v_err := sqlstate || ' ' || sqlerrm;
  end;
  insert into said values ('ORDER_AGAIN', v_err);
  insert into said values ('ORDER_ONE', purse(w, me) || '|' || (select count(*) from buy_order where world_id = w and poster = me));
  perform pg_temp.req('${K2}');
  perform rpc_order(w, 'log', 2, 5);
  insert into said values ('ORDER_TWO', purse(w, me) || '|' || (select count(*) from buy_order where world_id = w and poster = me));

  -- A dig, the same key twice: one job, and run out, one go's dirt. Another key queues a second.
  perform pg_temp.req('${K3}');
  perform rpc_act(w, 'dig', '{"kind":"tile","x":16,"y":16,"cx":16,"cy":16}'::jsonb, 1);
  begin
    perform pg_temp.req('${K3}');
    perform rpc_act(w, 'dig', '{"kind":"tile","x":16,"y":16,"cx":16,"cy":16}'::jsonb, 1);
  exception when others then null;
  end;
  insert into said select 'DIG_JOBS', (act is not null)::int + jsonb_array_length(act_queue) from player where world_id = w and uid = me;
  for v_n in 1 .. 10 loop
    exit when (select act from player where world_id = w and uid = me) is null;
    update player set act_ends = now() - interval '1 second', stats = jsonb_set(stats, '{stamina}', '1')
     where world_id = w and uid = me;
    perform settle(w, me);
  end loop;
  insert into said select 'DIG_DIRT', coalesce(sum(count), 0) from item where world_id = w and def = 'dirt';
  perform pg_temp.req('${K4}');
  perform rpc_act(w, 'dig', '{"kind":"tile","x":16,"y":16,"cx":16,"cy":16}'::jsonb, 1);
  insert into said select 'DIG_ANOTHER', (act is not null)::int + jsonb_array_length(act_queue) from player where world_id = w and uid = me;
  perform rpc_cancel(w);

  -- A key whose call rolled back is free: the order and the key went with it.
  perform pg_temp.req('${K5}');
  begin
    perform rpc_order(w, 'log', 1, 1);
    raise exception 'and then something went wrong';
  exception when others then null;
  end;
  insert into said values ('ROLLED', (select count(*) from private.once_key where uid = me and key = '${K5}')::text);
  perform pg_temp.req('${K5}');
  perform rpc_order(w, 'log', 1, 1);
  insert into said values ('ROLLED_AGAIN', purse(w, me) || '|' || (select count(*) from buy_order where world_id = w and poster = me));

  -- Past the window: taken afresh.
  update private.once_key set at = now() - private.once_window() - interval '1 second' where uid = me and key = '${K1}';
  perform pg_temp.req('${K1}');
  begin
    perform rpc_order(w, 'log', 1, 1);
    v_err := 'went through';
  exception when others then v_err := sqlstate;
  end;
  insert into said values ('LAPSED', v_err);

  -- A door run from inside another: a parcel of no things is a letter (\`rpc_parcel\` runs \`rpc_letter\`), one key.
  perform set_config('request.jwt.claims', json_build_object('sub', '${OTHER}')::text, true);
  perform rpc_join(w, 'Twyla');
  perform set_config('request.jwt.claims', v_as, true);
  perform pg_temp.req('${K6}');
  begin
    v_err := coalesce((rpc_parcel(w, '${OTHER}', 'Twice?', '{}'::bigint[]))->>'sent', 'nothing sent');
  exception when others then v_err := sqlstate || ' ' || sqlerrm;
  end;
  insert into said values ('NESTED', v_err);

  -- A door that only reads, with a key already taken: answered.
  begin
    perform rpc_ground(w, 10);
    perform pg_temp.req('${K6}');
    perform rpc_ground(w, 10);
    v_err := 'answered';
  exception when others then v_err := sqlstate || ' ' || sqlerrm;
  end;
  insert into said values ('LOOK', v_err);

  -- No key: not counted.
  perform pg_temp.req(null);
  v_n := (select count(*) from private.once_key where uid = me);
  perform rpc_order(w, 'log', 1, 1);
  perform pg_temp.req(null);
  perform rpc_order(w, 'log', 1, 1);
  insert into said values ('NOKEY', ((select count(*) from private.once_key where uid = me) - v_n)::text);

  -- Not a key.
  perform pg_temp.req('twice please');
  begin
    perform rpc_order(w, 'log', 1, 1);
    v_err := 'went through';
  exception when others then v_err := sqlstate || ' ' || sqlerrm;
  end;
  insert into said values ('NOTAKEY', v_err);

  -- The sweep: what is past the window goes, what is not stays.
  update private.once_key set at = now() - private.once_window() - interval '1 minute' where uid = me and key = '${K2}';
  perform private.once_sweep();
  insert into said values ('SWEPT', (select string_agg(key::text, ',' order by key) from private.once_key where uid = me and key in ('${K2}', '${K3}')));
end $t$;
-- Every door that changes something starts by taking a key; none that only reads or walks does.
insert into said select 'KEYED', count(*) filter (where pg_get_functiondef(p.oid) like '%perform private.once();%')
    || '|' || count(*) filter (where pg_get_functiondef(p.oid) not like '%perform private.once();%')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
 where p.proname like 'rpc\\_%' and private.pace_class(p.proname) in ('act', 'deal', 'land');
insert into said select 'UNKEYED', count(*) filter (where pg_get_functiondef(p.oid) like '%private.once()%')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
 where p.proname like 'rpc\\_%' and private.pace_class(p.proname) in ('look', 'move');
select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) said.set(line.slice(0, i), line.slice(i + 1));
}

check('an order put up twice with one key: the second refused with WK409',
  (said.get('ORDER_AGAIN') ?? '').startsWith(`${ONCE_TAKEN} `), said.get('ORDER_AGAIN'));
check('and its silver held once: 90 left of 100, one order', said.get('ORDER_ONE') === '90|1', said.get('ORDER_ONE'));
check('with another key, a second order and another 10 held', said.get('ORDER_TWO') === '80|2', said.get('ORDER_TWO'));
check('a dig asked twice with one key is one job', said.get('DIG_JOBS') === '1', said.get('DIG_JOBS'));
check('and run out, one go\'s dirt', said.get('DIG_DIRT') === '1', said.get('DIG_DIRT'));
check('another key asks another', said.get('DIG_ANOTHER') === '1', said.get('DIG_ANOTHER'));
check('a key whose call rolled back is not kept', said.get('ROLLED') === '0', said.get('ROLLED'));
check('and is taken by the call sent again, which goes through once', said.get('ROLLED_AGAIN') === '79|3', said.get('ROLLED_AGAIN'));
check('a key past the window is taken afresh', said.get('LAPSED') === 'went through', said.get('LAPSED'));
check('a door run from inside another takes its call\'s key once', said.get('NESTED') === 'Twice?', said.get('NESTED'));
check('a door that only reads keeps no key', said.get('LOOK') === 'answered', said.get('LOOK'));
check('a call with no key is not counted', said.get('NOKEY') === '0', said.get('NOKEY'));
check('a key that is not one is a bad request', (said.get('NOTAKEY') ?? '').startsWith('22023 Bad request: x-wurm-once'), said.get('NOTAKEY'));
check('the sweep lets go of a key past the window and keeps the rest', said.get('SWEPT') === K3, said.get('SWEPT'));
{
  const [keyed, unkeyed] = (said.get('KEYED') ?? '0|0').split('|');
  check('every door that changes something takes a key', Number(keyed) > 50 && unkeyed === '0', `${keyed} do, ${unkeyed} do not`);
}
check('no door that reads or walks does', said.get('UNKEYED') === '0', said.get('UNKEYED'));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nan action taken once — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
