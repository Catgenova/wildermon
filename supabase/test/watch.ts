/**
 * The island's watch: where things come from, whether they add up, and the
 * flags a keeper is shown.
 *
 * On an island of its own, Watchfold, founded by Kell, with Anna and Bram
 * seen on one IP, Cora on another and Dov on a third:
 *
 *   * the ledger: a craft and a forage are each written under their action,
 *     what went in as gone and what came out as made, and a thing given by a
 *     job of the test under that job; what it adds to a craft, a forage, a
 *     step and a single insert, update and delete, measured with the triggers
 *     on and off;
 *   * reconciling: the count against the ledger holds after a normal day of
 *     crafting, foraging, dealing, posting, dropping, picking up and a bag
 *     thrown away with things in it; a thing written straight into the table
 *     holds too and is flagged as made outside any door; a thing written past
 *     the ledger altogether, and one taken out past it, are flagged as off it
 *     by exactly that many;
 *   * shared IP: a deal and a drop picked up between Anna and Bram are
 *     flagged, once, naming the ways and the silver; a deal between Anna and
 *     Cora and a drop Cora left for Dov are not;
 *   * no break: Dov, active for 21 hours, is flagged once; Cora, with a 40
 *     minute break, Anna, two hours in, and Bram, whose run the sampling lost
 *     sight of, are not;
 *   * skill rate: a rise of four times what an hour of the fastest goes at
 *     the best roll could teach is flagged; an hour of the fastest goes at an
 *     ordinary roll is not;
 *   * the keeper's doors: only a keeper may list the flags or mark them seen,
 *     each mark is written in the trail, a second look is counted on the
 *     first one's row; the window's lines say each flag's numbers;
 *   * keeping: a flag past 30 days goes at night;
 *   * and no browser reads the tables or calls the helpers.
 *
 * Makes and removes everything it uses, so it runs on the database the suite
 * leaves behind or on any other with the migrations in it.
 */
import { execFileSync } from 'node:child_process';
import {
  flagLabel, flagLine, WATCH_AWAKE_HOURS, WATCH_BREAK_MINS, WATCH_KEEP_DAYS, WATCH_SKILL_MINS, WATCH_SKILL_TIMES,
  WATCH_STOCK_PER_MILLE, type WatchFlags,
} from '../../src/game/watch';

const ENV = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
  PGPORT: process.env.PGPORT ?? '5433',
  PGUSER: process.env.PGUSER ?? 'wurm',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
};

interface Ran { out: string; err: string }
const sql = (text: string): Ran => {
  try {
    const out = execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'],
      { input: text, encoding: 'utf8', env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    return { out: out.trim(), err: '' };
  } catch (e) {
    const x = e as { stdout?: string; stderr?: string };
    return { out: (x.stdout ?? '').trim(), err: (x.stderr ?? '').trim() || String(e) };
  }
};
/** As the owner of the database: the setting up and the looking. */
const psql = (text: string): string => {
  const r = sql(text);
  if (r.err) throw new Error(r.err);
  return r.out;
};
/** Through the role a browser has, as somebody signed in. */
const as = (who: string, text: string): Ran => sql(
  `select set_config('request.jwt.claims', '${JSON.stringify({ sub: who })}', false) \\g /dev/null\nset role authenticated;\n${text}\n`);
const anon = (text: string): Ran => sql(`set role anon;\n${text}\n`);

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const W = 'ef000000-0000-4000-8000-0000000000a1';
const KELL = 'ef000000-0000-4000-8000-000000000001'; // founded Watchfold, keeps it
const ANNA = 'ef000000-0000-4000-8000-000000000002';
const BRAM = 'ef000000-0000-4000-8000-000000000003'; // on Anna's IP
const CORA = 'ef000000-0000-4000-8000-000000000004';
const DOV = 'ef000000-0000-4000-8000-000000000005';
const ALL = [KELL, ANNA, BRAM, CORA, DOV];
const list = (xs: string[]): string => xs.map((x) => `'${x}'`).join(', ');
const NAME: Record<string, string> = { [KELL]: 'Kell', [ANNA]: 'Anna', [BRAM]: 'Bram', [CORA]: 'Cora', [DOV]: 'Dov' };

const CLEAN = `
delete from private.watch_flag where world_id = '${W}';
delete from private.watch_made where world_id = '${W}';
delete from private.watch_made_new where world_id = '${W}';
delete from private.watch_stock where world_id = '${W}';
delete from private.watch_hand where world_id = '${W}';
delete from private.watch_drop where world_id = '${W}';
delete from private.watch_body where world_id = '${W}';
delete from private.watch_skill where world_id = '${W}';
delete from private.owner_log where world_id = '${W}';
delete from private.player_ip where uid in (${list(ALL)});
delete from world where id = '${W}';
delete from auth.users where id in (${list(ALL)});
delete from caller where uid in (${list(ALL)});
`;
psql(CLEAN);
const BODY = `'{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb`;
psql(`
insert into auth.users (id, email) values
  ('${KELL}', 'kell@watch.test'), ('${ANNA}', 'anna@watch.test'), ('${BRAM}', 'bram@watch.test'),
  ('${CORA}', 'cora@watch.test'), ('${DOV}', 'dov@watch.test');
insert into world (id, name, seed, size, spawn_x, spawn_y, ready, made_by) values ('${W}', 'Watchfold', 1, 32, 5, 5, true, '${KELL}');
select land_blank('${W}', 32) \\g /dev/null
select land_set_tile('${W}', gx, gy, tile_id('Grass')) from generate_series(0, 31) gx, generate_series(0, 31) gy \\g /dev/null
insert into player (world_id, uid, name, x, y, stats) values
  ('${W}', '${KELL}', 'Kell', 20.5, 20.5, ${BODY}), ('${W}', '${ANNA}', 'Anna', 5.5, 5.5, ${BODY}),
  ('${W}', '${BRAM}', 'Bram', 6.5, 5.5, ${BODY}), ('${W}', '${CORA}', 'Cora', 7.5, 5.5, ${BODY}),
  ('${W}', '${DOV}', 'Dov', 8.5, 5.5, ${BODY});
insert into private.player_ip (uid, ip) values
  ('${ANNA}', '203.0.113.7'), ('${BRAM}', '203.0.113.7'), ('${BRAM}', '198.51.100.20'),
  ('${CORA}', '198.51.100.9'), ('${DOV}', '192.0.2.44');
insert into skill (world_id, uid, id, value) values ('${W}', '${ANNA}', 'foraging', 90);
select give('${W}', '${ANNA}', 'log', 200, 40, 'Oak') \\g /dev/null
select give('${W}', '${ANNA}', 'saw', 1, 60) \\g /dev/null
select give('${W}', '${ANNA}', 'rope', 4, 30) \\g /dev/null
select give('${W}', '${BRAM}', 'coin', 20, 50, 'Silver') \\g /dev/null
select give('${W}', '${CORA}', 'coin', 20, 50, 'Silver') \\g /dev/null
select give('${W}', '${CORA}', 'rope', 2, 30) \\g /dev/null
`);
const W_ = `'${W}'`;
/** One go of an action, as its owner asks for it and the island settles it, with the wait taken off. */
const go = (who: string, action: string, target: string): string => `
select set_config('request.jwt.claims', '${JSON.stringify({ sub: who })}', false) \\g /dev/null
delete from caller where uid = '${who}';
update player set stats = ${BODY} where world_id = ${W_} and uid = '${who}';
select rpc_act(${W_}, '${action}', ${target}, 1) \\g /dev/null
update player set act_started = act_started - interval '300 seconds', act_ends = act_ends - interval '300 seconds'
 where world_id = ${W_} and uid = '${who}';
select settle(${W_}, '${who}') \\g /dev/null
`;
const LOG = `jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = ${W_} and holder_uid = '${ANNA}' and def = 'log' limit 1))`;
const ledger = (): Map<string, string> => {
  psql('select private.watch_merge();');
  const rows = psql(`select def || '|' || source || '|' || made_qty || '|' || gone_qty from private.watch_made
                      where world_id = ${W_} order by def, source;`);
  return new Map(rows.split('\n').filter((r) => r).map((r) => {
    const [def, source, made, gone] = r.split('|');
    return [`${def}|${source}`, `${made}|${gone}`];
  }));
};
const flags = (kind: string): string[] => psql(`select coalesce(uid::text, '') || '|' || detail::text from private.watch_flag
  where world_id = ${W_} and kind = '${kind}' order by n;`).split('\n').filter((r) => r);

/* ---- the ledger ----------------------------------------------------------------- */
console.log('--- the ledger');
const given = ledger();
check('a thing given by a job of the test is written under that job', given.get('log|give') === '200|0' && given.get('coin|give') === '40|0',
  [...given].join(' '));
psql(`${go(ANNA, 'make_planks', LOG)}
update player set x = 9.5, y = 9.5 where world_id = ${W_} and uid = '${ANNA}';
${go(ANNA, 'forage', `'{"kind":"tile","x":9,"y":9}'`)}
update player set x = 5.5, y = 5.5 where world_id = ${W_} and uid = '${ANNA}';`);
const made = ledger();
const planks = Number(psql(`select coalesce(sum(count), 0) from item where world_id = ${W_} and def = 'plank';`));
check('a craft: the log it took is gone and the planks it made are made, under the action',
  made.get('log|act:make_planks') === '0|1' && made.get(`plank|act:make_planks`) === `${planks}|0` && planks > 0,
  `${made.get('log|act:make_planks')} ${made.get('plank|act:make_planks')}, ${planks} planks`);
const found = psql(`select coalesce(sum(count), 0) from item where world_id = ${W_} and holder_uid = '${ANNA}'
  and def not in ('log', 'saw', 'rope', 'plank');`);
const foraged = [...made].filter(([k]) => k.endsWith('|act:forage')).reduce((n, [, v]) => n + Number(v.split('|')[0]), 0);
check('a forage: everything it found is made, under the action', foraged === Number(found) && foraged > 0,
  `${foraged} in the ledger, ${found} in the pack`);
check('and nothing else is written', [...made].every(([k]) => /\|(give|act:make_planks|act:forage)$/.test(k)),
  [...made].map(([k]) => k).join(' '));

/*
 * What the ledger costs. A craft and a forage, through the door and settled,
 * a step, and an insert, an update and a delete on their own: each with the
 * three triggers on and off, in turn, three rounds, the median call; and,
 * with them on, the time spent inside the three triggers themselves, which a
 * busy machine does not drown the way it drowns the difference of two
 * medians. Rolled back.
 */
const cost = psql(`
begin;
set local track_functions = 'pl';
select set_config('request.jwt.claims', '${JSON.stringify({ sub: ANNA })}', true) \\g /dev/null
create temp sequence spot;
create temp table took (what text, on_ boolean, ms double precision, ledger double precision, fired bigint);
create function pg_temp.ledger() returns double precision[] language sql as $f$
  select array[coalesce(sum(pg_stat_get_xact_function_total_time(p.oid)), 0), coalesce(sum(pg_stat_get_xact_function_calls(p.oid)), 0)]
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname in ('watch_items_in', 'watch_items_out', 'watch_item_changed') $f$;
create function pg_temp.t(p_what text, p_on boolean, p_n int) returns void language plpgsql as $f$
declare w uuid := ${W_}; u uuid := '${ANNA}'; t0 timestamptz; i int; v_ms double precision; v_log bigint; v_id bigint;
        k int := 0; tx int; ty int; l0 double precision[]; l1 double precision[];
begin
  execute format('alter table item %s trigger watch_in', case when p_on then 'enable' else 'disable' end);
  execute format('alter table item %s trigger watch_out', case when p_on then 'enable' else 'disable' end);
  execute format('alter table item %s trigger watch_changed', case when p_on then 'enable' else 'disable' end);
  for i in 1..p_n loop
    v_ms := 0;
    l0 := pg_temp.ledger();
    delete from caller where uid = u;
    update player set stats = ${BODY}, act = null, act_queue = '[]'::jsonb where world_id = w and uid = u;
    if p_what = 'craft' then
      select id into v_log from item where world_id = w and holder_uid = u and def = 'log' limit 1;
      t0 := clock_timestamp();
      perform rpc_act(w, 'make_planks', jsonb_build_object('kind', 'item', 'uid', v_log), 1);
      v_ms := v_ms + extract(epoch from clock_timestamp() - t0);
      update player set act_ends = now() - interval '1 second' where world_id = w and uid = u;
      t0 := clock_timestamp();
      perform settle(w, u);
      v_ms := v_ms + extract(epoch from clock_timestamp() - t0);
    elsif p_what = 'forage' then
      k := nextval('pg_temp.spot');
      tx := 10 + k % 20; ty := 10 + (k / 20) % 20;
      update player set x = tx + 0.5, y = ty + 0.5 where world_id = w and uid = u;
      t0 := clock_timestamp();
      perform rpc_act(w, 'forage', jsonb_build_object('kind', 'tile', 'x', tx, 'y', ty), 1);
      v_ms := v_ms + extract(epoch from clock_timestamp() - t0);
      update player set act_ends = now() - interval '1 second' where world_id = w and uid = u;
      t0 := clock_timestamp();
      perform settle(w, u);
      v_ms := v_ms + extract(epoch from clock_timestamp() - t0);
    elsif p_what = 'step' then
      update player set x = 5.5, y = 5.5, moved_at = now() - interval '1 second' where world_id = w and uid = u;
      t0 := clock_timestamp();
      perform rpc_move(w, 5.9, 5.5, 0);
      v_ms := v_ms + extract(epoch from clock_timestamp() - t0);
    elsif p_what = 'row' then
      t0 := clock_timestamp();
      insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'rope', 30, 1) returning id into v_id;
      update item set count = 2 where id = v_id;
      delete from item where id = v_id;
      v_ms := v_ms + extract(epoch from clock_timestamp() - t0);
    end if;
    l1 := pg_temp.ledger();
    insert into pg_temp.took values (p_what, p_on, v_ms * 1000, l1[1] - l0[1], (l1[2] - l0[2])::bigint);
  end loop;
end $f$;
do $$
declare r int; w text; o boolean;
begin
  for r in 1..3 loop
    foreach w in array array['craft', 'forage', 'step', 'row'] loop
      foreach o in array array[false, true] loop
        perform pg_temp.t(w, o, case w when 'step' then 100 when 'row' then 200 else 10 end);
      end loop;
    end loop;
  end loop;
end $$;
select string_agg(round(m::numeric, 3) || ',' || round(l::numeric, 3) || ',' || round(f::numeric, 1), '|' order by o, on_) from (
  select array_position(array['craft', 'forage', 'step', 'row'], what) as o, on_,
         percentile_cont(0.5) within group (order by ms) as m, avg(ledger) as l, avg(fired) as f
    from took group by what, on_) x;
rollback;`).split('\n').pop() ?? '';
const COSTS = ['craft', 'forage', 'rpc_move', 'insert+update+delete'];
const costs = cost.split('|').map((c) => c.split(',').map(Number));
const said = COSTS.map((what, i) => {
  const [off, on] = [costs[2 * i], costs[2 * i + 1]];
  return `${what} ${off[0]} -> ${on[0]} ms (median; ${on[1]} ms in ${on[2]} trigger calls)`;
}).join('; ');
console.log(`COST ${said}`);
const [craft, forage, step, row] = [1, 3, 5, 7].map((i) => costs[i]);
check('the ledger\'s own triggers take under half a millisecond of a craft and of a forage, and a twentieth of either',
  craft[1] < 0.5 && forage[1] < 0.5 && craft[1] < craft[0] / 20 && forage[1] < forage[0] / 20, said);
check('and fire not at all on a step', step[2] === 0 && step[1] === 0, said);
check('and under a quarter of a millisecond on each write to the item table', row[1] / 3 < 0.25, said);

/* ---- reconciling ---------------------------------------------------------------- */
console.log('--- reconciling');
psql(`select private.watch_reconcile(${W_});`);
check('the first count is only written down', flags('stock').length === 0
  && Number(psql(`select count(*) from private.watch_stock where world_id = ${W_};`)) > 0);
// A normal day: crafting, foraging, a deal for silver, a parcel, a drop picked up, and a bag thrown away full.
psql(`${go(ANNA, 'make_planks', LOG)}
update player set x = 12.5, y = 12.5 where world_id = ${W_} and uid = '${ANNA}';
${go(ANNA, 'forage', `'{"kind":"tile","x":12,"y":12}'`)}
update player set x = 5.5, y = 5.5 where world_id = ${W_} and uid = '${ANNA}';
select set_config('request.jwt.claims', '${JSON.stringify({ sub: ANNA })}', false) \\g /dev/null
delete from caller where uid = '${ANNA}';
select rpc_deal(${W_}, '${BRAM}', array[(select id from item where world_id = ${W_} and holder_uid = '${ANNA}' and def = 'plank' limit 1)], 7, 0) \\g /dev/null
select rpc_deal(${W_}, '${CORA}', array[(select id from item where world_id = ${W_} and holder_uid = '${ANNA}' and def = 'rope' limit 1)], 3, 0) \\g /dev/null
select set_config('request.jwt.claims', '${JSON.stringify({ sub: BRAM })}', false) \\g /dev/null
select rpc_deal_answer(${W_}, (select n from deal where world_id = ${W_} and buyer = '${BRAM}' and closed_at is null), true) \\g /dev/null
select set_config('request.jwt.claims', '${JSON.stringify({ sub: CORA })}', false) \\g /dev/null
select rpc_deal_answer(${W_}, (select n from deal where world_id = ${W_} and buyer = '${CORA}' and closed_at is null), true) \\g /dev/null
-- Anna drops her logs and Bram picks them up; Cora drops a rope and Dov picks it up.
update item set holder = 'ground', holder_uid = null, gx = 5, gy = 5
 where world_id = ${W_} and holder_uid = '${ANNA}' and def = 'log';
update item set holder = 'player', holder_uid = '${BRAM}', gx = null, gy = null
 where world_id = ${W_} and holder = 'ground' and def = 'log';
update item set holder = 'ground', holder_uid = null, gx = 7, gy = 5
 where id = (select id from item where world_id = ${W_} and holder_uid = '${CORA}' and def = 'rope' limit 1);
update item set holder = 'player', holder_uid = '${DOV}', gx = null, gy = null
 where world_id = ${W_} and holder = 'ground' and def = 'rope';
-- A satchel with two ropes in it, thrown away whole.
select give(${W_}, '${CORA}', 'satchel', 1, 30) \\g /dev/null
select give(${W_}, '${CORA}', 'rope', 2, 30) \\g /dev/null
update item set holder = 'bag', inside = (select id from item where world_id = ${W_} and def = 'satchel')
 where world_id = ${W_} and holder_uid = '${CORA}' and def = 'rope' and inside is null;
delete from item where world_id = ${W_} and def = 'satchel';
`);
// What Bram was handed, before anything below takes from it.
const bramGot = Number(psql(`select sum(count) from item where world_id = ${W_} and holder_uid = '${BRAM}' and def in ('plank', 'log');`));
const inBag = psql(`select count(*) from item where world_id = ${W_} and def = 'satchel';`);
psql(`select private.watch_reconcile(${W_});`);
check('after a normal day the count and the ledger agree on everything', inBag === '0' && flags('stock').length === 0,
  flags('stock').join(' '));
check('and nothing on it was made outside a door', flags('no_door').length === 0, flags('no_door').join(' '));
// Straight into the table: the ledger sees it, and says nobody's door made it.
psql(`insert into item (world_id, holder, holder_uid, def, ql, count) values (${W_}, 'player', '${DOV}', 'nail', 50, 3);
select private.watch_reconcile(${W_});`);
const noDoor = flags('no_door');
check('a thing written straight into the table still adds up', flags('stock').length === 0, flags('stock').join(' '));
check('and is flagged as made outside any door, with how many',
  noDoor.length === 1 && JSON.parse(noDoor[0].split('|')[1]).def === 'nail' && JSON.parse(noDoor[0].split('|')[1]).count === 3,
  noDoor.join(' '));
// Past the ledger altogether: two ropes forged, and three planks gone.
psql(`set session_replication_role = replica;
insert into item (world_id, holder, holder_uid, def, ql, count) values (${W_}, 'player', '${DOV}', 'rope', 30, 2);
update item set count = count - 1 where id = (select id from item where world_id = ${W_} and def = 'plank' and count > 1 limit 1);
set session_replication_role = origin;
select private.watch_reconcile(${W_});`);
const off = flags('stock').map((f) => JSON.parse(f.split('|')[1]) as { def: string; diff: number; found: number; expected: number });
check('a forged duplicate is flagged as that many more than the ledger accounts for',
  off.some((f) => f.def === 'rope' && f.diff === 2 && f.found === f.expected + 2), JSON.stringify(off));
check('and a thing gone past the ledger as that many fewer', off.some((f) => f.def === 'plank' && f.diff === -1),
  JSON.stringify(off));
check('and nothing else', off.length === 2, JSON.stringify(off));
psql(`select private.watch_reconcile(${W_});`);
check('a difference is flagged once: the next count starts from what is there', flags('stock').length === 2);

/* ---- the sweep ------------------------------------------------------------------ */
console.log('--- shared IP, no break, skill rate');
// No break: Dov 21 hours in; Cora 21 hours in but with a 40-minute break; Anna 2 hours in; Bram's run lost to the sampling.
psql(`
insert into private.watch_body (world_id, uid, run_from, last_at, sampled_at) values
  (${W_}, '${DOV}', now() - interval '21 hours', now() - interval '1 minute', now() - interval '5 minutes'),
  (${W_}, '${CORA}', now() - interval '21 hours', now() - interval '40 minutes', now() - interval '5 minutes'),
  (${W_}, '${ANNA}', now() - interval '2 hours', now() - interval '1 minute', now() - interval '5 minutes'),
  (${W_}, '${BRAM}', now() - interval '21 hours', now() - interval '30 minutes', now() - interval '30 minutes')
on conflict (world_id, uid) do update set run_from = excluded.run_from, last_at = excluded.last_at, sampled_at = excluded.sampled_at, flagged = false;
update player set moved_at = now() where world_id = ${W_} and uid in ('${DOV}', '${ANNA}', '${BRAM}');
update player set moved_at = now() - interval '40 minutes', act = null, act_started = now() - interval '50 minutes'
 where world_id = ${W_} and uid = '${CORA}';
update player set act = null, act_started = null where world_id = ${W_} and uid in ('${DOV}', '${BRAM}');
`);
// Skill rate: Dov's carpentry four hours of best goes up in one; Anna's an hour of fastest goes at an ordinary roll.
const honest = psql(`
delete from skill where world_id = ${W_} and uid in ('${ANNA}', '${DOV}') and id = 'carpentry';
insert into skill (world_id, uid, id, value) values (${W_}, '${ANNA}', 'carpentry', 10), (${W_}, '${DOV}', 'carpentry', 10);
insert into private.watch_skill (world_id, uid, id, value, at) values
  (${W_}, '${ANNA}', 'carpentry', 10, now() - interval '${WATCH_SKILL_MINS + 1} minutes'),
  (${W_}, '${DOV}', 'carpentry', 10, now() - interval '${WATCH_SKILL_MINS + 1} minutes')
on conflict (world_id, uid, id) do update set value = excluded.value, at = excluded.at;
do $$
declare v double precision := 10; n int; i int; m double precision;
begin
  m := skill_mult(${W_}, '${ANNA}', 'carpentry');
  n := floor(${(WATCH_SKILL_MINS + 1) * 60} / private.watch_fastest(${W_}, '${ANNA}', 'carpentry', 10));
  for i in 1..n loop v := v + skill_gain_of(v, m, 1.0); end loop;
  update skill set value = v where world_id = ${W_} and uid = '${ANNA}' and id = 'carpentry';
  m := skill_mult(${W_}, '${DOV}', 'carpentry');
  n := 4 * floor(${(WATCH_SKILL_MINS + 1) * 60} / private.watch_fastest(${W_}, '${DOV}', 'carpentry', 10));
  v := 10;
  for i in 1..n loop v := v + skill_gain_of(v, m, private.watch_best_roll()); end loop;
  update skill set value = v where world_id = ${W_} and uid = '${DOV}' and id = 'carpentry';
end $$;
update player set skills_at = now() where world_id = ${W_} and uid in ('${ANNA}', '${DOV}');
select round(value::numeric, 2) || '|' || (select round(value::numeric, 2) from skill where world_id = ${W_} and uid = '${DOV}' and id = 'carpentry')
  from skill where world_id = ${W_} and uid = '${ANNA}' and id = 'carpentry';
`);
const swept = psql('select private.watch_sweep();');
console.log(`sweep: ${swept}; carpentry after the hour, Anna|Dov: ${honest}`);

const shared = flags('shared_ip').map((f) => JSON.parse(f.split('|')[1]) as Record<string, unknown>);
const pair = (g: string, t: string): Record<string, unknown> | undefined => shared.find((d) => d.giver === g && d.getter === t);
const ab = pair(ANNA, BRAM);
check('things passed from one account to another seen on the same IP are flagged, naming the ways and the IP',
  !!ab && JSON.stringify(ab.via) === JSON.stringify(['ground', 'rpc_deal_answer']) && ab.things === bramGot && ab.ip === '203.0.113.7',
  `${JSON.stringify(shared)}; Bram holds ${bramGot} planks and logs`);
const ba = pair(BRAM, ANNA);
check('and silver back the other way, by how much', !!ba && ba.silver === 7 && ba.things === 0, JSON.stringify(ba));
check('and nobody else: not Anna and Cora, not Cora and Dov', shared.length === 2,
  shared.map((d) => `${NAME[String(d.giver)]}>${NAME[String(d.getter)]}`).join(' '));
const awake = flags('awake');
check(`a body active for over ${WATCH_AWAKE_HOURS} hours with no ${WATCH_BREAK_MINS}-minute break is flagged`,
  awake.length === 1 && awake[0].startsWith(DOV) && JSON.parse(awake[0].split('|')[1]).hours === 21, awake.join(' '));
const runs = psql(`select uid || ':' || coalesce(to_char(run_from, 'x'), 'none') from private.watch_body
  where world_id = ${W_} and uid in ('${CORA}', '${BRAM}', '${ANNA}') order by uid;`).split('\n');
check('a break ends the run, and a gap in the sampling starts a new one',
  runs.some((r) => r === `${CORA}:none`) && psql(`select extract(epoch from now() - run_from) < 120 from private.watch_body
    where world_id = ${W_} and uid = '${BRAM}';`) === 't', runs.join(' '));
const skillRate = flags('skill').map((f) => JSON.parse(f.split('|')[1]) as Record<string, number | string>);
check(`a skill risen by more than ${WATCH_SKILL_TIMES} times what its fastest goes could teach in ${WATCH_SKILL_MINS} minutes is flagged`,
  skillRate.length === 1 && flags('skill')[0].startsWith(DOV) && Number(skillRate[0].times) > WATCH_SKILL_TIMES
    && Number(skillRate[0].times) < 5, JSON.stringify(skillRate));
check('and an hour of the fastest goes at an ordinary roll is not', !flags('skill').some((f) => f.startsWith(ANNA)));
const marks = psql(`select count(*) from private.watch_skill k join skill s using (world_id, uid, id)
  where k.world_id = ${W_} and k.id = 'carpentry' and k.at > now() - interval '1 minute' and k.value = s.value;`);
check('each mark is set again, to where the skill is, after it is read', marks === '2', marks);
psql('select private.watch_sweep();');
check('a second sweep raises nothing again',
  flags('shared_ip').length === 2 && flags('awake').length === 1 && flags('skill').length === 1);

/* ---- the keeper's doors --------------------------------------------------------- */
console.log('--- the keeper');
const REFUSED = 'only a keeper of this island may do that';
for (const [door, call] of [['flags', `select rpc_owner_flags('${W}');`], ['seen', `select rpc_owner_flag_seen('${W}', null);`]]) {
  check(`${door}: nobody signed in may not call it`, anon(call).err.includes('permission denied for function'), anon(call).err);
  const r = as(ANNA, call);
  check(`${door}: refused to a player of the island`, r.err.includes(REFUSED), r.err || r.out);
}
const look = (): WatchFlags => JSON.parse(as(KELL, `select rpc_owner_flags('${W}');`).out) as WatchFlags;
const first = look();
const total = Number(psql(`select count(*) from private.watch_flag where world_id = ${W_};`));
check('the keeper is shown every flag, newest first, all open', first.flags.length === total && first.open === total
  && first.flags.every((f, i) => i === 0 || f.n < first.flags[i - 1].n), `${first.flags.length} of ${total}, ${first.open} open`);
check('with whose they are, by name', first.flags.filter((f) => f.uid).every((f) => f.name === NAME[f.uid ?? '']),
  first.flags.map((f) => f.name).join(','));
check('every kind has its label and a line of its numbers',
  ['shared_ip', 'awake', 'skill', 'stock', 'no_door'].every((k) => first.flags.some((f) => f.kind === k))
    && first.flags.every((f) => flagLabel(f.kind) !== f.kind && /\d/.test(flagLine(f)) && !flagLine(f).includes('undefined')),
  first.flags.map((f) => `${flagLabel(f.kind)}: ${flagLine(f)}`).join(' / '));
for (const f of first.flags) console.log(`  ${flagLabel(f.kind)}${f.name ? `: ${f.name}` : ''} — ${flagLine(f)}`);
const one = first.flags[0];
const marked = as(KELL, `select rpc_owner_flag_seen('${W}', ${one.n});`);
check('one flag marked seen', JSON.parse(marked.out).seen === 1 && look().open === total - 1, marked.out || marked.err);
const again = as(KELL, `select rpc_owner_flag_seen('${W}', ${one.n});`);
check('and marking it again says there is no open flag', JSON.parse(again.out).why === 'No open flag.', again.out);
const rest = as(KELL, `select rpc_owner_flag_seen('${W}', null);`);
check('the rest marked seen at once', JSON.parse(rest.out).seen === total - 1 && look().open === 0, rest.out);
const trail = psql(`select what || ':' || coalesce(detail->>'looks', detail->>'flags') from private.owner_log
  where world_id = ${W_} order by n;`).split('\n');
check('the trail: the looks on one row, and each mark', JSON.stringify(trail) === JSON.stringify(['flags:3', 'flag_seen:1', 'flag_seen:' + (total - 1)]),
  trail.join(' '));

/* ---- keeping -------------------------------------------------------------------- */
console.log('--- keeping');
psql(`insert into private.watch_flag (world_id, kind, detail, at) values (${W_}, 'awake', '{}', now() - interval '${WATCH_KEEP_DAYS + 1} days');`);
psql('select private.watch_night();');
check(`a flag older than ${WATCH_KEEP_DAYS} days goes at night, and the rest stay`,
  psql(`select count(*) from private.watch_flag where world_id = ${W_};`) === String(total));
const numbers = psql(`select private.watch_keep_days() || '|' || private.watch_awake_hours() || '|' || private.watch_break_mins()
  || '|' || private.watch_skill_times() || '|' || private.watch_skill_mins() || '|' || private.watch_stock_per_mille();`);
check('the window\'s numbers are the island\'s',
  numbers === [WATCH_KEEP_DAYS, WATCH_AWAKE_HOURS, WATCH_BREAK_MINS, WATCH_SKILL_TIMES, WATCH_SKILL_MINS, WATCH_STOCK_PER_MILLE].join('|'),
  numbers);

/* ---- shut to browsers ----------------------------------------------------------- */
console.log('--- shut');
const tables = ['player_ip', 'watch_made', 'watch_made_new', 'watch_stock', 'watch_hand', 'watch_drop', 'watch_body', 'watch_skill', 'watch_flag'];
const read = tables.filter((t) => !as(ANNA, `select count(*) from private.${t};`).err);
check('no browser can read any of the tables', read.length === 0, read.join(' '));
const helpers = ['watch_sweep()', 'watch_night()', 'watch_merge()', `watch_reconcile('${W}')`, 'watch_source()']
  .filter((h) => !as(ANNA, `select private.${h};`).err);
check('or call the helpers', helpers.length === 0, helpers.join(' '));

psql(CLEAN);
for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`the island's watch — ${ok.length} of ${ok.length}`);
