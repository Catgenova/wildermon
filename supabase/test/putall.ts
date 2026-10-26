/**
 * Put all in, in one ask (20261026210000).
 *
 * Reported: "Did I crash the server trying to transfer all of my relics to the cart at once?" Put all in sent one
 * `rpc_act` a stack, all at once; a pack of 150 relics was 150 asks, refused past the pace from the 61st on. What
 * this asks, on an island of its own:
 *
 *   * a pack of 150 things -- 100 fragments of relics, 40 restored relics, a kept pile, a supreme pile beside an
 *     ordinary one of the same, loose stacks -- put in a crate and in a cart as the browser now asks it
 *     (`rpc_act_many`, `act_many_most()` to a call, one call after another), with the clock running alongside:
 *     every thing either in the store or still in the pack, not one made or lost; what the store had room for in
 *     it, and the rest said as did not fit; the kept pile kept and left in the pack; the supreme pile supreme in
 *     the store and apart from the ordinary one; where each thing came from as it was; one line a call; every call
 *     and the clock never waiting on them, and no call refused by the pace;
 *   * a job in hand: nothing done, and `busy` said; a job it does not do, too many things, a target not a thing:
 *     refused in one line;
 *   * a round of the clock with a body's row held by somebody else: that body is left for the next round, said in
 *     `tick_time` as `busy`, and the round goes on and settles the rest;
 *   * a guard's look round for what hurt somebody, and `wild_quarry` off its index of legs, against every wild
 *     thing read the old way: the same answer;
 *   * an instant `rpc_act` asks the job's refusal once, not again in the `settle` that does it;
 *   * and in the browser, against a keeper that is a stub on `fetch`: 70 things are three calls of at most
 *     `ACT_MANY_MOST`, each sent when the last is answered, the pack laid from the answers, and a `busy` answer
 *     hands back the things not yet asked for (`Island.actMany`).
 *
 * Makes and removes everything it uses.
 */
import { execFile, execFileSync } from 'node:child_process';
import { ACT_MANY_JOBS, ACT_MANY_MOST, Island, type ItemRow } from '../../src/net/island';

const ENV = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
  PGPORT: process.env.PGPORT ?? '5433',
  PGUSER: process.env.PGUSER ?? 'wurm',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
};
const ARGS = ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'];
const psql = (text: string): string => execFileSync('psql', ARGS, { input: text, encoding: 'utf8', env: ENV, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const later = (text: string): Promise<{ out: string; err: string }> => new Promise((done) => {
  const child = execFile('psql', ARGS, { encoding: 'utf8', env: ENV, maxBuffer: 64 << 20 }, (e, out, err) =>
    done({ out: (out ?? '').trim(), err: e ? (err || String(e)) : '' }));
  child.stdin?.end(text);
});

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const W = 'ee000000-0000-4000-8000-0000000000e1';
const A = 'ee000000-0000-4000-8000-000000000001';
const B = 'ee000000-0000-4000-8000-000000000002';
const C = 'ee000000-0000-4000-8000-000000000003';
const FOLK = [A, B, C];
const list = (xs: string[]): string => xs.map((x) => `'${x}'`).join(', ');
const CLEAN = `
delete from world where id = '${W}';
delete from auth.users where id in (${list(FOLK)});
delete from caller where uid in (${list(FOLK)});
`;
psql(CLEAN);

/** The budgets: a call of `act_many_most()` things, and a round of the clock while the puts go on, over the round before them. */
const CALL_MS = 3000;
const ALL_MS = 10000;
/** And the longest the clock may stand waiting on a lock while they go, in samples of 50 ms: its `tick_lock_wait()` and a little. */
const WAIT_SAMPLES = 8;
/** Things in the pack. */
const N = 150;

const BODY = `'{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb`;
psql(`
insert into auth.users (id, email) values ${FOLK.map((u, i) => `('${u}', 'putall${i + 1}@putall.test')`).join(', ')};
insert into world (id, name, seed, size, spawn_x, spawn_y, ready, made_by) values ('${W}', 'Putwater', 11, 64, 10, 10, true, '${A}');
select land_blank('${W}', 64) \\g /dev/null
insert into player (world_id, uid, name, x, y, stats) values
  ('${W}', '${A}', 'Putter', 10.5, 10.5, ${BODY}), ('${W}', '${B}', 'Holder', 30.5, 30.5, ${BODY}), ('${W}', '${C}', 'Other', 40.5, 40.5, ${BODY});
`);

/** A store beside A: a cart (placed) or a crate. */
const cart = (): number => Number(psql(`insert into placed (world_id, kind, sub, x, y, cx, cy, made_by, ql)
  values ('${W}', 'furniture', 'cart', 11, 10, 11.5, 10.5, '${A}', 50) returning id;`));
const crate = (): void => {
  psql(`insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by, material) values ('${W}', 1, 'plank', 10, 11, 0, 0, false, '${A}', 'pine');`);
};
const reset = (): void => {
  psql(`delete from item where world_id = '${W}'; delete from crate where world_id = '${W}'; delete from placed where world_id = '${W}';
    delete from event where world_id = '${W}'; delete from caller where uid in (${list(FOLK)});
    update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null, act_goes = null,
      act_queue = '[]'::jsonb, away = false, seen_at = now(), body_at = now(), stats = ${BODY} where world_id = '${W}';`);
};
/** The pack: N rows, the relics among them none of which stack. */
const pack = (): void => {
  psql(`
insert into item (world_id, holder, holder_uid, def, ql, count, extra, piece, dmg, rare)
select '${W}', 'player', '${A}', 'fragment', 20 + g % 50, 1, (array['ancient_comb','ancient_lamp','ancient_pot','ancient_file'])[1 + g % 4],
       (g % 7)::text, 10 + g % 30, case when g % 9 = 0 then 'rare' end
  from generate_series(1, 100) g;
insert into item (world_id, holder, holder_uid, def, ql, count)
select '${W}', 'player', '${A}', (array['ancient_comb','ancient_lamp','ancient_pot','ancient_file','ancient_collar','ancient_brace','ancient_whetstone','rune_tablet'])[1 + g % 8],
       30 + g % 40, 1 from generate_series(1, 40) g;
insert into item (world_id, holder, holder_uid, def, ql, count, locked) values ('${W}', 'player', '${A}', 'mortar', 40, 10, true);
insert into item (world_id, holder, holder_uid, def, ql, count, rare) values ('${W}', 'player', '${A}', 'plank', 40, 6, 'supreme');
insert into item (world_id, holder, holder_uid, def, ql, count) values ('${W}', 'player', '${A}', 'plank', 30, 5);
insert into item (world_id, holder, holder_uid, def, ql, count)
select '${W}', 'player', '${A}', (array['rock_shards','iron_ore','log','mortar'])[1 + g % 4], 20 + g, 2 + g from generate_series(1, ${N - 143}) g;
`);
};

/** Every unit of A's world by holder: what is in the pack and what is in the store, and the origins, before and after. */
const census = (): { pack: number; store: number; rows: number; origins: string } => {
  const [p, s, r, o] = psql(`select
    (select coalesce(sum(count), 0) from item where world_id = '${W}' and holder = 'player'),
    (select coalesce(sum(count), 0) from item where world_id = '${W}' and holder in ('crate', 'furniture')),
    (select count(*) from item where world_id = '${W}'),
    (select md5(string_agg(def || ':' || coalesce(origin, '') || ':' || coalesce(origin_fn, ''), ',' order by def, origin, origin_fn)) from (select distinct def, origin, origin_fn from item where world_id = '${W}') q);`).split('|');
  return { pack: Number(p), store: Number(s), rows: Number(r), origins: o };
};

/** What the browser sends: every loose thing in the pack, as Put all in does (`putAll`). */
const asks = (into: number): Array<Record<string, unknown>> => psql(`select json_build_object('kind', 'item', 'uid', id, 'count', count, 'into', ${into})
  from item where world_id = '${W}' and holder = 'player' and holder_uid = '${A}' and not locked order by id;`).split('\n').filter(Boolean)
  .map((l) => JSON.parse(l) as Record<string, unknown>);
const lit = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
/** One call as A, as PostgREST makes it: its own transaction, signed in. Its answer, and how long it took in there. */
const asA = (call: string): Promise<{ out: string; err: string }> => later(`
select set_config('request.jwt.claims', '${JSON.stringify({ sub: A, role: 'authenticated' })}', false) \\g /dev/null
begin;
set local role authenticated;
select clock_timestamp() as t0 \\gset
select ${call};
select round(extract(epoch from clock_timestamp() - :'t0'::timestamptz) * 1000);
commit;
`);

/** The clock, a round every 0.2 s for as long as `running` says: how long each took. */
const clock = (rounds: number): Promise<number[]> => later(Array.from({ length: rounds }, () => `
select clock_timestamp() as t0 \\gset
select world_tick() \\g /dev/null
select 'R', round(extract(epoch from clock_timestamp() - :'t0'::timestamptz) * 1000);
select pg_sleep(0.2) \\g /dev/null`).join('\n')).then((r) => {
  if (r.err) throw new Error(`the clock: ${r.err}`);
  return r.out.split('\n').filter((l) => l.startsWith('R|')).map((l) => Number(l.split('|')[1]));
});

/**
 * Whether the clock waited on a lock, every 50 ms for `secs`: the longest it stood waiting, in samples. A round
 * that waits on the puts, or the puts on a round, stands here.
 */
const watch = (secs: number): Promise<number> => later(`
create temp table waited (most int);
do $$
declare t0 timestamptz := clock_timestamp(); run int := 0; most int := 0;
begin
  while clock_timestamp() < t0 + interval '${secs} seconds' loop
    if exists (select 1 from pg_stat_activity a where a.datname = current_database() and a.query like 'select world_tick()%'
                  and a.wait_event_type = 'Lock') then run := run + 1; else run := 0; end if;
    most := greatest(most, run);
    perform pg_sleep(0.05);
  end loop;
  insert into waited values (most);
end $$;
select most from waited;`).then((r) => (r.err ? -1 : Number(r.out)));

/** Put all in, as the browser asks it: `act_many_most()` to a call, each when the last has answered. */
const putAll = async (action: string, targets: Array<Record<string, unknown>>): Promise<{ ms: number[]; answers: Array<Record<string, unknown>>; errs: string[] }> => {
  const ms: number[] = [];
  const answers: Array<Record<string, unknown>> = [];
  const errs: string[] = [];
  for (let i = 0; i < targets.length; i += ACT_MANY_MOST) {
    const r = await asA(`rpc_act_many('${W}', '${action}', ${lit(targets.slice(i, i + ACT_MANY_MOST))}) - 'pack' - 'crates'`);
    if (r.err) errs.push(r.err);
    const [answer, took] = r.out.split('\n');
    answers.push(JSON.parse(answer || '{}') as Record<string, unknown>);
    ms.push(Number(took));
  }
  return { ms, answers, errs };
};

console.log('--- the same rules as the island and the browser');
check('act_many_most() is the browser\'s ACT_MANY_MOST', psql('select act_many_most();') === String(ACT_MANY_MOST), `${psql('select act_many_most();')} / ${ACT_MANY_MOST}`);
const jobs = psql(`select string_agg(id, ',' order by id) from action_def where private.act_many_job(id);`);
check('private.act_many_job is the browser\'s ACT_MANY_JOBS, every one an instant job',
  jobs === [...ACT_MANY_JOBS].sort().join(',') && psql(`select bool_and(instant) from action_def where private.act_many_job(id);`) === 't', jobs);

for (const where of ['crate', 'cart'] as const) {
  console.log(`--- ${N} things put in a ${where}, the clock going`);
  reset();
  pack();
  let into = 1;
  if (where === 'crate') crate();
  else into = cart();
  const room = Number(where === 'crate'
    ? psql(`select crate_spare('${W}', c) from crate c where c.world_id = '${W}' and c.id = 1;`)
    : psql(`select furniture_spare(p) from placed p where p.id = ${into};`));
  const before = census();
  const targets = asks(into);
  const action = where === 'crate' ? 'store_in_crate' : 'store_in_furniture';
  const alone = await clock(3);
  const t0 = Date.now();
  let all = 0;
  const [put, during, waited] = await Promise.all([
    putAll(action, targets).then((r) => {
      all = Date.now() - t0;
      return r;
    }),
    clock(Math.ceil(N / ACT_MANY_MOST) * 2 + 4),
    watch(8),
  ]);
  const after = census();
  const moved = put.answers.reduce((n, a) => n + Number(a.moved ?? 0), 0);
  console.log(`    ${targets.length} things in ${put.ms.length} calls: ${put.ms.join(', ')} ms; the clock alone ${alone.join(', ')} ms, while putting ${during.join(', ')} ms; ${all} ms in all`);
  check(`${where}: every call answered`, put.errs.length === 0, put.errs.join(' / '));
  check(`${where}: ${Math.ceil(targets.length / ACT_MANY_MOST)} calls for ${targets.length} things`, put.ms.length === Math.ceil(targets.length / ACT_MANY_MOST));
  check(`${where}: every call inside ${CALL_MS} ms`, put.ms.every((m) => m <= CALL_MS), put.ms.join(', '));
  check(`${where}: the lot inside ${ALL_MS} ms`, all <= ALL_MS, `${all} ms`);
  check(`${where}: the clock never stood waiting on a lock more than ${WAIT_SAMPLES * 50} ms`, waited >= 0 && waited <= WAIT_SAMPLES, `${waited} samples of 50 ms`);
  check(`${where}: not one made or lost`, before.pack + before.store === after.pack + after.store,
    `${before.pack}+${before.store} → ${after.pack}+${after.store}`);
  check(`${where}: what it had room for went in (${room}), and was said`, after.store === room && moved === room, `${after.store} in, ${moved} said`);
  check(`${where}: the rest said as did not fit or refused`, put.answers.some((a) => Number(a.refused ?? 0) > 0 || Number(a.left ?? 0) > 0),
    JSON.stringify(put.answers.map((a) => [a.moved, a.left, a.refused])));
  check(`${where}: the kept pile kept, and in the pack`,
    psql(`select string_agg(count || ':' || locked, ',') from item where world_id = '${W}' and def = 'mortar' and locked;`) === '10:true'
    && psql(`select string_agg(holder, ',') from item where world_id = '${W}' and def = 'mortar' and locked;`) === 'player');
  const planks = psql(`select string_agg(holder || ':' || coalesce(rare, '-') || ':' || count, ',' order by holder, rare nulls last) from item where world_id = '${W}' and def = 'plank';`);
  check(`${where}: the supreme planks supreme, apart from the ordinary ones`,
    !psql(`select 1 from item where world_id = '${W}' and def = 'plank' group by holder, crate, placed having count(distinct coalesce(rare, '-')) > 1 and count(*) < 2 limit 1;`)
    && psql(`select coalesce(sum(count), 0) from item where world_id = '${W}' and def = 'plank' and rare = 'supreme';`) === '6'
    && psql(`select coalesce(sum(count), 0) from item where world_id = '${W}' and def = 'plank' and rare is null;`) === '5', planks);
  check(`${where}: where each thing came from, as it was`, before.origins === after.origins);
  const lines = psql(`select count(*) from event where world_id = '${W}' and uid = '${A}';`);
  check(`${where}: one line a call`, Number(lines) === put.ms.length, `${lines} lines, ${put.ms.length} calls`);
  check(`${where}: no call refused by the pace`, !put.errs.some((e) => /Too many requests/.test(e)));
  check(`${where}: no go fell over`, psql(`select count(*) from event where world_id = '${W}' and text like '%Island error%';`) === '0');
}

console.log('--- refused, and busy');
reset();
pack();
const cartId = cart();
const one = asks(cartId).slice(0, 3);
psql(`update player set act = 'dig', act_target = '{"kind":"tile","x":10,"y":10}'::jsonb, act_started = now(), act_ends = now() + interval '1 hour', act_left = 1, act_goes = 1
  where world_id = '${W}' and uid = '${A}';`);
const busy = await asA(`rpc_act_many('${W}', 'store_in_furniture', ${lit(one)}) - 'pack' - 'crates'`);
check('a job in hand: busy, and nothing done', /"busy": true/.test(busy.out) && census().store === 0, busy.out.split('\n')[0] || busy.err);
psql(`update player set act = null, act_target = null, act_ends = null, act_left = null, act_goes = null where world_id = '${W}' and uid = '${A}';`);
const refusals: Array<[string, string]> = [
  [`rpc_act_many('${W}', 'dig', ${lit(one)})`, 'Bad request: rpc_act_many p_action: not one of its jobs.'],
  [`rpc_act_many('${W}', 'store_in_furniture', ${lit(Array.from({ length: ACT_MANY_MOST + 1 }, () => one[0]))})`, `Bad request: rpc_act_many p_targets: 1 to ${ACT_MANY_MOST} things.`],
  [`rpc_act_many('${W}', 'store_in_furniture', ${lit([{ kind: 'tile', x: 10, y: 10 }])})`, 'Bad request: rpc_act_many p_targets[0].kind: things only.'],
  [`rpc_act_many('${W}', 'store_in_furniture', ${lit([{ kind: 'item', uid: 'x' }])})`, 'Bad request: rpc_act_many p_targets[0].uid'],
];
for (const [call, words] of refusals) {
  const r = await asA(call);
  check(`refused in one line: "${words}"`, r.err.includes(words), r.err.split('\n')[0] || r.out);
}

console.log('--- a round of the clock with a body held');
reset();
// B and C each with a go due; B's row held by somebody else for four seconds.
for (const u of [B, C]) {
  psql(`update player set act = 'take_from_store', act_target = '{"kind":"item","uid":1}'::jsonb, act_started = now() - interval '2 seconds',
    act_ends = now() - interval '1 second', act_left = 1, act_goes = 1, act_queue = '[]'::jsonb, body_at = now()
    where world_id = '${W}' and uid = '${u}';`);
}
const holder = later(`begin; select 1 from player where world_id = '${W}' and uid = '${B}' for update \\g /dev/null
select pg_sleep(4) \\g /dev/null
commit;`);
for (let i = 0; i < 400; i++) {
  if (psql(`select count(*) from pg_locks l join pg_stat_activity a on a.pid = l.pid where a.query like '%pg_sleep(4)%' and l.locktype = 'transactionid' and l.granted;`) !== '0') break;
}
const tick = psql(`select clock_timestamp() as t0 \\gset
select world_tick() \\g /dev/null
select round(extract(epoch from clock_timestamp() - :'t0'::timestamptz) * 1000), (select coalesce((stages->>'busy')::int, -1) from tick_time order by at desc limit 1);`).split('|');
await holder;
const settledC = psql(`select act is null from player where world_id = '${W}' and uid = '${C}';`);
const waitedB = psql(`select act is not null from player where world_id = '${W}' and uid = '${B}';`);
check('the round did not wait for the held row', Number(tick[0]) < 2500, `${tick[0]} ms`);
check('the held body is left for the next round, and said so (busy)', waitedB === 't' && Number(tick[1]) >= 1, `B waiting: ${waitedB}, busy ${tick[1]}`);
check('and the rest are settled', settledC === 't');
psql(`select world_tick() \\g /dev/null`);
check('the next round settles it', psql(`select act is null from player where world_id = '${W}' and uid = '${B}';`) === 't');

console.log('--- a look round for wild things');
const looks = psql(`
begin;
select setseed(0.5);
do $$
declare w uuid := '${W}'; i int; s int; fx double precision; fy double precision;
begin
  for i in 1..400 loop
    s := creature_spawn(w, (array['rabba','bevere','noot','quarra'])[1 + i % 4], 1 + random() * 62, 1 + random() * 62, 'wild', now() - interval '3 days', null);
    fx := 1 + random() * 62; fy := 1 + random() * 62;
    -- Somewhere on a leg of up to twelve tiles, some arrived, some setting off, some half way.
    update creature set from_x = fx, from_y = fy,
        to_x = greatest(0.5, least(63.5, fx + (random() - 0.5) * 24)), to_y = greatest(0.5, least(63.5, fy + (random() - 0.5) * 24)),
        leg_at = now() - make_interval(secs => random() * 20), leg_ends = now() + make_interval(secs => random() * 20 - 5),
        hitched_to = null
      where world_id = w and id = s;
  end loop;
end $$;
create temp table spots as select 4 + random() * 56 as cx, 4 + random() * 56 as cy, 2 + random() * 10 as r, random() * 64 as fx, random() * 64 as fy
  from generate_series(1, 60);
select count(*), count(*) filter (where (wild_quarry('${W}', cx, cy, r, fx, fy)).id is not distinct from (
    select q.id from creature q where q.world_id = '${W}' and q.mode = 'wild' and q.hitched_to is null
      and greatest(abs(creature_x(q) - cx), abs(creature_y(q) - cy)) <= r
    order by (creature_x(q) - fx) ^ 2 + (creature_y(q) - fy) ^ 2, q.id limit 1)),
  count(*) filter (where (wild_quarry('${W}', cx, cy, r, fx, fy)).id is not null)
  from spots;
-- A guard of A's settlement, defensive, and two wild things in its range: the one that hurt somebody is the one.
insert into deed (world_id, name, x, y, radius, level, founded_by) values ('${W}', 'Putstead', 20, 20, 10, 5, '${A}');
delete from creature where world_id = '${W}' and greatest(abs(to_x - 20.5), abs(to_y - 20.5)) < 16 or greatest(abs(from_x - 20.5), abs(from_y - 20.5)) < 16;
create temp table cr (k text, id int);
insert into cr select 'guard', creature_spawn('${W}', 'mola', 20.5, 20.5, 'deed', now() - interval '60 days', '${A}');
insert into cr select 'near', creature_spawn('${W}', 'rabba', 21.5, 20.5, 'wild', now() - interval '3 days', null);
insert into cr select 'hurter', creature_spawn('${W}', 'rabba', 24.5, 20.5, 'wild', now() - interval '3 days', null);
update creature set stance = 'defensive', phase = 'idle', carrying = null, hurt_at = null, hurt_by = null where id = (select id from cr where k = 'guard') and world_id = '${W}';
update player set stats = stats || jsonb_build_object('hurtAt', now(), 'hurtBy', (select id from cr where k = 'hurter')) where world_id = '${W}' and uid = '${B}';
select 'HURT', (fight_target('${W}', (select id from cr where k = 'guard'))).id = (select id from cr where k = 'hurter');
update player set stats = stats || jsonb_build_object('hurtAt', now() - interval '1 day') where world_id = '${W}' and uid = '${B}';
select 'OLD', (fight_target('${W}', (select id from cr where k = 'guard'))).id is null;
update creature set hurt_at = now(), hurt_by = (select id from cr where k = 'near') where id = (select id from cr where k = 'guard') and world_id = '${W}';
select 'MINE', (fight_target('${W}', (select id from cr where k = 'guard'))).id = (select id from cr where k = 'near');
rollback;
`).split('\n');
const [spots, same, found] = looks[0].split('|').map(Number);
check('wild_quarry off its index of legs: the same wild thing as every one read the old way, at every spot', spots === 60 && same === 60, `${same} of ${spots} the same, ${found} found one`);
check('and it finds some', found > 5, `${found}`);
const said = new Map(looks.slice(1).map((l) => l.split('|') as [string, string]));
check('a guard looks for the wild thing that hurt somebody lately', said.get('HURT') === 't', said.get('HURT'));
check('and not for one that hurt somebody long ago', said.get('OLD') === 't', said.get('OLD'));
check('and for the one that hurt it', said.get('MINE') === 't', said.get('MINE'));

console.log('--- an instant ask asks its refusal once');
reset();
pack();
const cart2 = cart();
const counted = psql(`
select set_config('request.jwt.claims', '${JSON.stringify({ sub: A, role: 'authenticated' })}', false) \\g /dev/null
set track_functions = 'all';
begin;
select rpc_act('${W}', 'store_in_furniture', jsonb_build_object('kind', 'item', 'uid', (select min(id) from item where world_id = '${W}' and holder = 'player' and def = 'fragment'), 'count', 1, 'into', ${cart2}), 1) \\g /dev/null
select coalesce((select calls from pg_stat_xact_user_functions where funcname = 'act_refusal'), 0), (select count(*) from item where world_id = '${W}' and holder = 'furniture');
rollback;
`).split('|');
check('one act_refusal for an instant put, and it went in', counted[0] === '1' && counted[1] === '1', `${counted[0]} asked, ${counted[1]} in`);

/* ---- the browser ---------------------------------------------------------------------------------- */
console.log('--- the browser');
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const row = (id: number): ItemRow => ({
  id, def: 'fragment', ql: 40, dmg: 0, count: 1, extra: null, holder: 'player', charges: null, locked: false, issued: false,
  rare: null, dye: null, bless: null, maker: null, piece: null, lit: false, lit_at: null, inside: null, gx: null, gy: null,
});
const calls: Array<{ n: number; go: (busy?: boolean) => void }> = [];
let open = 0;
let most = 0;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.endsWith('/rest/v1/rpc/rpc_act_many')) return json([]);
  const body = JSON.parse(String(init?.body ?? '{}')) as { p_targets?: unknown[] };
  open += 1;
  most = Math.max(most, open);
  return new Promise<Response>((done) => {
    calls.push({
      n: body.p_targets?.length ?? 0,
      go: (busy = false) => {
        open -= 1;
        done(json(busy ? { started: false, busy: true } : { started: true, done: true, moved: body.p_targets?.length, pack: [row(calls.length)], crates: [] }));
      },
    });
  });
}) as typeof fetch;
const isle = new Island({} as never);
isle.info = { id: 'w', name: 'w', seed: 1, size: 64, spawn_x: 0, spawn_y: 0, ready: true, epoch: '2026-01-01T00:00:00Z' };
let shown: ItemRow[] = [];
isle.hooks.pack = (items) => {
  shown = items;
};
const waitFor = async (n: number): Promise<void> => {
  for (let i = 0; i < 400 && calls.length < n; i++) await new Promise((r) => setTimeout(r, 5));
};
const things = Array.from({ length: 70 }, (_, i) => ({ kind: 'item', uid: i + 1, count: 1, into: 9 }));
const done = isle.actMany('store_in_furniture', things);
for (let i = 0; i < 3; i++) {
  await waitFor(i + 1);
  await new Promise((r) => setTimeout(r, 20));
  calls[i]?.go();
}
const got = await done;
check(`70 things are three calls of at most ${ACT_MANY_MOST}`, calls.length === 3 && calls.every((c) => c.n <= ACT_MANY_MOST) && calls.reduce((n, c) => n + c.n, 0) === 70,
  calls.map((c) => c.n).join(', '));
check('each sent when the last was answered', most === 1, `${most} open at once`);
check('the pack laid from the answers', shown.length === 1 && shown[0].id === 3 && got.rest.length === 0, JSON.stringify(shown.map((r) => r.id)));
calls.length = 0;
const held = isle.actMany('store_in_furniture', things);
await waitFor(1);
calls[0].go();
await waitFor(2);
calls[1].go(true);
const back = await held;
check('a busy answer hands back the things not yet done', back.busy && back.rest.length === 40 && calls.length === 2, `${back.rest.length} back, ${calls.length} calls`);

psql(CLEAN);
for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
