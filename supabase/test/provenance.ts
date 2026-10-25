/**
 * Modified things: where each thing came from, the sweep that finds the
 * impossible ones, the keeper's hold on one, and work faster than its pace.
 *
 * On an island of its own, Provenfold, kept by Hale, with Ines and Joss:
 *
 *   * origin: a craft, a forage, a butchering and a deal each write their
 *     kind, their door and whose it was on what they make; a part split off a
 *     stack is the stack's; a migration's and a straight insert's are said as
 *     such; and every row from before reads `before`;
 *   * the sweep, in a transaction rolled back with the table's own checks
 *     taken off: each kind of impossible thing is flagged once, with what it
 *     is held to, and filed to the keepers as one report a holder; good things
 *     beside them are not; nothing on the island is changed; a second sweep
 *     adds no flag and no report; it stops at `sweep_rows()` rows and goes on
 *     from there;
 *   * the hold: only a keeper may take a thing out of play or list the
 *     findings; held, no browser sees it; put back, it is where it was; each
 *     is written in the trail;
 *   * work rate: twenty forages due half a second apart are flagged, with the
 *     goes, the rate and the most there could be; twenty due at the pace are
 *     not, nor a backlog settled all at once;
 *   * and no browser reads the tables or calls the helpers.
 *
 * Makes and removes everything it uses, so it runs on the database the suite
 * leaves behind or on any other with the migrations in it.
 */
import { execFileSync } from 'node:child_process';
import { flagLabel, flagLine, WATCH_RATE_LEAST, WATCH_RATE_TIMES, type WatchFlag } from '../../src/game/watch';
import { reportReason } from '../../src/game/keeper';

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
const psql = (text: string): string => {
  const r = sql(text);
  if (r.err) throw new Error(r.err);
  return r.out;
};
const as = (who: string, text: string): Ran => sql(
  `select set_config('request.jwt.claims', '${JSON.stringify({ sub: who })}', false) \\g /dev/null\nset role authenticated;\n${text}\n`);
const anon = (text: string): Ran => sql(`set role anon;\n${text}\n`);

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const W = 'e5a00000-0000-4000-8000-0000000000a1';
const HALE = 'e5a00000-0000-4000-8000-000000000001'; // made Provenfold, keeps it
const INES = 'e5a00000-0000-4000-8000-000000000002';
const JOSS = 'e5a00000-0000-4000-8000-000000000003';
const ALL = [HALE, INES, JOSS];
const list = (xs: string[]): string => xs.map((x) => `'${x}'`).join(', ');
const W_ = `'${W}'`;
const ISLAND = '00000000-0000-0000-0000-000000000000';

const CLEAN = `
delete from private.watch_flag where world_id = ${W_};
delete from private.watch_made where world_id = ${W_};
delete from private.watch_made_new where world_id = ${W_};
delete from private.watch_hand where world_id = ${W_};
delete from private.item_flag where world_id = ${W_};
delete from private.item_quarantine where world_id = ${W_};
delete from private.player_report where world_id = ${W_};
delete from private.owner_log where world_id = ${W_};
delete from world where id = ${W_};
delete from auth.users where id in (${list(ALL)});
delete from caller where uid in (${list(ALL)});
`;
psql(CLEAN);
const BODY = `'{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb`;
psql(`
insert into auth.users (id, email) values ('${HALE}', 'hale@proven.test'), ('${INES}', 'ines@proven.test'), ('${JOSS}', 'joss@proven.test');
insert into world (id, name, seed, size, spawn_x, spawn_y, ready, made_by) values (${W_}, 'Provenfold', 1, 32, 5, 5, true, '${HALE}');
select land_blank(${W_}, 32) \\g /dev/null
select land_set_tile(${W_}, gx, gy, tile_id('Grass')) from generate_series(0, 31) gx, generate_series(0, 31) gy \\g /dev/null
insert into player (world_id, uid, name, x, y, stats) values
  (${W_}, '${HALE}', 'Hale', 20.5, 20.5, ${BODY}), (${W_}, '${INES}', 'Ines', 5.5, 5.5, ${BODY}),
  (${W_}, '${JOSS}', 'Joss', 6.5, 5.5, ${BODY});
insert into skill (world_id, uid, id, value) values (${W_}, '${INES}', 'foraging', 90), (${W_}, '${INES}', 'butchering', 50);
select give(${W_}, '${INES}', 'log', 20, 40, 'Oak') \\g /dev/null
select give(${W_}, '${INES}', 'saw', 1, 60) \\g /dev/null
select give(${W_}, '${INES}', 'butchering_knife', 1, 60) \\g /dev/null
select give(${W_}, '${INES}', 'rope', 4, 30) \\g /dev/null
select give(${W_}, '${JOSS}', 'coin', 20, 50, 'Silver') \\g /dev/null
`);

/** One go of an action, as its owner asks for it and the island settles it, with the wait taken off. */
const go = (who: string, action: string, target: string): string => `
select set_config('request.jwt.claims', '${JSON.stringify({ sub: who })}', false) \\g /dev/null
delete from caller where uid = '${who}';
update player set stats = ${BODY} where world_id = ${W_} and uid = '${who}';
select rpc_act(${W_}, '${action}', ${target}, 1) \\g /dev/null
update player set act_started = act_started - interval '300 seconds', act_ends = act_ends - interval '300 seconds'
 where world_id = ${W_} and uid = '${who}';
select settle(${W_}, '${who}') \\g /dev/null
select set_config('request.jwt.claims', '', false) \\g /dev/null
`;
/** Each row of a kind of thing on the island made since `after`: origin|fn|uid. */
const origins = (where: string, after = 0): string[] => psql(`
select coalesce(origin, '-') || '|' || coalesce(origin_fn, '-') || '|' || coalesce(origin_uid::text, '-') from item
 where world_id = ${W_} and id > ${after} and (${where}) order by id;`).split('\n').filter((r) => r);
const top = (): number => Number(psql('select coalesce(max(id), 0) from item;'));

/* ---- origin --------------------------------------------------------------------- */
console.log('--- origin');
check('every row from before reads before: the column\'s value for rows older than it',
  psql(`select attmissingval::text from pg_attribute where attrelid = 'public.item'::regclass and attname = 'origin';`) === '{before}'
    && psql(`select pg_get_expr(adbin, adrelid) from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
              where d.adrelid = 'public.item'::regclass and a.attname = 'origin';`) === '');
check('a thing given by a job of the clock is the clock\'s', origins(`def = 'saw'`).join(' ') === 'clock|give|-',
  origins(`def = 'saw'`).join(' '));

let at = top();
const LOG = `jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = ${W_} and holder_uid = '${INES}' and def = 'log' limit 1))`;
psql(go(INES, 'make_planks', LOG));
const planks = origins(`def = 'plank'`, at);
check('a craft: what it makes is craft, under the action, and the crafter\'s',
  planks.length > 0 && planks.every((p) => p === `craft|act:make_planks|${INES}`), planks.join(' '));

at = top();
psql(`update player set body_at = now(), x = 9.5, y = 9.5 where world_id = ${W_} and uid = '${INES}';
${go(INES, 'forage', `'{"kind":"tile","x":9,"y":9}'`)}`);
const foraged = origins('true', at);
check('a forage: what it finds is gather, under the action, and the forager\'s',
  foraged.length > 0 && foraged.every((p) => p === `gather|act:forage|${INES}`), foraged.join(' '));

at = top();
psql(`update player set body_at = now(), x = 9.5, y = 9.5 where world_id = ${W_} and uid = '${INES}';
insert into item (world_id, holder, gx, gy, def, ql, count, extra, origin) values (${W_}, 'ground', 9, 9, 'corpse', 50, 1, 'Rabba', 'loot');
${go(INES, 'butcher', `'{"kind":"ground","x":9,"y":9}'`)}`);
const butchered = origins(`def <> 'corpse'`, at);
check('a butchering: what comes off is loot, under the action, and the butcher\'s',
  butchered.length > 0 && butchered.every((p) => p === `loot|act:butcher|${INES}`), butchered.join(' '));

at = top();
psql(`
select set_config('request.jwt.claims', '${JSON.stringify({ sub: INES })}', false) \\g /dev/null
delete from caller where uid = '${INES}';
select rpc_deal(${W_}, '${JOSS}', array[(select id from item where world_id = ${W_} and holder_uid = '${INES}' and def = 'rope' limit 1)], 7, 0) \\g /dev/null
select set_config('request.jwt.claims', '${JSON.stringify({ sub: JOSS })}', false) \\g /dev/null
delete from caller where uid = '${JOSS}';
select rpc_deal_answer(${W_}, (select n from deal where world_id = ${W_} and buyer = '${JOSS}' and closed_at is null), true) \\g /dev/null
`);
const paid = origins(`def = 'coin' and holder_uid = '${INES}'`, at);
check('a deal: the silver paid is trade, under the door, and the one who took the deal\'s',
  paid.length > 0 && paid.every((p) => p === `trade|rpc_deal_answer|${JOSS}`), paid.join(' '));

at = top();
const plankId = psql(`select id from item where world_id = ${W_} and holder_uid = '${INES}' and def = 'plank' and count > 1 order by id limit 1;`);
psql(`select move_part(${plankId}, 1, 'ground', null, null, null) \\g /dev/null`);
const part = origins(`def = 'plank'`, at);
check('a part split off a stack is the stack\'s', part.length === 1 && part[0] === `craft|act:make_planks|${INES}`, part.join(' '));

at = top();
psql(`select set_config('wurm.source', 'migration', false) \\g /dev/null
insert into item (world_id, holder, holder_uid, def, ql, count) values (${W_}, 'player', '${JOSS}', 'nail', 50, 3);`);
check('a thing a migration writes is the migration\'s', origins(`def = 'nail'`, at).join(' ') === 'migration|migration|-',
  origins(`def = 'nail'`, at).join(' '));
at = top();
psql(`insert into item (world_id, holder, holder_uid, def, ql, count) values (${W_}, 'player', '${JOSS}', 'nail', 50, 3);`);
check('and one written straight into the table is by no door', origins(`def = 'nail'`, at).join(' ') === 'none|sql|-',
  origins(`def = 'nail'`, at).join(' '));
psql(`delete from item where world_id = ${W_} and origin = 'none';`);

const KINDS: Array<[string, string]> = [
  ['act:make_planks', 'craft'], ['act:smith', 'craft'], ['act:forage', 'gather'], ['act:mine', 'gather'],
  ['act:shear', 'gather'], ['act:butcher', 'loot'], ['act:attack_creature', 'loot'], ['act:repair_item', 'repair'],
  ['act:improve_item', 'repair'], ['act:pick_up', 'move'], ['rpc_barter_accept', 'trade'], ['rpc_buy', 'trade'],
  ['rpc_owner_clear', 'keeper'], ['rpc_found', 'door'], ['world_tick', 'clock'], ['migration', 'migration'], ['sql', 'none'],
];
const kinds = psql(`select string_agg(private.origin_kind(s), ' ' order by o) from unnest(array[${KINDS.map(([s]) => `'${s}'`).join(', ')}]) with ordinality as t(s, o);`);
check('each door is the kind it is', kinds === KINDS.map(([, k]) => k).join(' '),
  KINDS.map(([s], i) => `${s}=${kinds.split(' ')[i]}`).join(' '));

/* ---- the sweep ------------------------------------------------------------------ */
console.log('--- the sweep');
// Each impossible kind, with the checks that refuse them taken off, beside good ones; rolled back.
const MIG = `select set_config('wurm.source', 'migration', true) \\g /dev/null`;
const PLAIN = `select set_config('wurm.source', '', true) \\g /dev/null`;
const swept = psql(`
begin;
alter table item drop constraint item_ql_check, drop constraint item_count_check, drop constraint item_dmg_check;
${MIG}
create temp table bad_one (tag text, id bigint) on commit drop;
with x(tag, def, ql, dmg, count, rare, maker) as (values
  ('ql_over', 'rope', 140::real, 0::real, 1, null, null),
  ('ql_nan', 'rope', 'NaN'::real, 0::real, 1, null, null),
  ('ql_under', 'rope', -3::real, 0::real, 1, null, null),
  ('dmg', 'saw', 50::real, 120::real, 1, null, null),
  ('count_over', 'rope', 30::real, 0::real, 2000000, null, null),
  ('count_over_one', 'saw', 30::real, 0::real, 1001, null, null),
  ('count_under', 'rope', 30::real, 0::real, -2, null, null),
  ('no_def', 'no_such_thing', 30::real, 0::real, 1, null, null),
  ('ql_maker', 'awl', 60::real, 0::real, 1, null, 'Ines'),
  ('rare_unknown', 'saw', 30::real, 0::real, 1, 'mythic', null)),
ins as (
  insert into item (world_id, holder, holder_uid, def, ql, dmg, count, rare, maker)
  select ${W_}, 'player', '${JOSS}', x.def, x.ql, x.dmg, x.count, x.rare, x.maker from x
  returning id, def, ql, count, rare, maker)
insert into bad_one select x.tag, i.id from ins i join x on x.def = i.def and x.ql::text = i.ql::text and x.count = i.count
  and x.rare is not distinct from i.rare and x.maker is not distinct from i.maker;
${PLAIN}
insert into item (world_id, holder, holder_uid, def, ql, count, rare) values (${W_}, 'player', '${JOSS}', 'saw', 30, 1, 'rare')
  returning 'rare_no_roll' as tag, id \\g /dev/null
insert into bad_one select 'rare_no_roll', max(id) from item where world_id = ${W_} and def = 'saw' and rare = 'rare' and origin = 'none';
-- Good things: a rope, an awl made at what its maker can make, a rare saw off a door that rolls one.
select give(${W_}, '${HALE}', 'rope', 2, 30) \\g /dev/null
select give(${W_}, '${HALE}', 'awl', 1, 5, null, null, 'Ines') \\g /dev/null
select give(${W_}, '${HALE}', 'saw', 1, 30, null, 'rare') \\g /dev/null
create temp table good_one on commit drop as
  select id from item where world_id = ${W_} and id not in (select id from bad_one) and origin is distinct from 'none';
insert into private.item_sweep_mark (one) values (true) on conflict (one) do nothing;
update private.item_sweep_mark set last_id = (select min(id) - 1 from item where world_id = ${W_});
create temp table before_sweep on commit drop as select md5(string_agg(i::text, ',' order by i.id)) as h from item i where i.world_id = ${W_};
select 'first|' || private.item_sweep()::text;
select 'unchanged|' || ((select h from before_sweep) = (select md5(string_agg(i::text, ',' order by i.id)) from item i where i.world_id = ${W_}));
select 'flag|' || b.tag || '|' || f.reason || '|' || private.item_flag_says(f.reason, f.detail)
  from private.item_flag f join bad_one b on b.id = f.item order by b.tag, f.reason;
select 'good|' || count(*) from private.item_flag f where f.item in (select id from good_one);
select 'report|' || r.whom || '|' || r.reason || '|' || r.note from private.player_report r
 where r.world_id = ${W_} and r.by_uid = '${ISLAND}' order by r.n;
update private.item_sweep_mark set last_id = (select min(id) - 1 from item where world_id = ${W_});
select private.item_sweep() \\g /dev/null
select 'again|' || count(*) || ',' || count(*) filter (where seen_at = now()) from private.item_flag where world_id = ${W_};
select 'reports|' || count(*) from private.player_report r where r.world_id = ${W_} and r.by_uid = '${ISLAND}';
select 'rows|' || sweep_rows()::int;
rollback;`).split('\n').filter((r) => r);
const line = (tag: string): string[] => swept.filter((r) => r.startsWith(`${tag}|`)).map((r) => r.slice(tag.length + 1));
const first = JSON.parse(line('first')[0] ?? '{}') as Record<string, number | boolean | null>;
const flagged = line('flag').map((r) => r.split('|'));
const WANT: Array<[string, string]> = [
  ['count_over', 'count_over'], ['count_over_one', 'count_over'], ['count_under', 'count_under'], ['dmg', 'dmg'],
  ['ql_maker', 'ql_maker'], ['ql_nan', 'ql_over'], ['ql_over', 'ql_over'], ['ql_under', 'ql_under'],
  ['no_def', 'no_def'], ['rare_no_roll', 'no_origin'], ['rare_no_roll', 'rare_no_roll'], ['rare_unknown', 'rare_unknown'],
];
const got = flagged.map(([t, r]) => `${t}:${r}`).sort();
check('each kind of impossible thing is flagged, once, for what it is',
  JSON.stringify(got) === JSON.stringify(WANT.map(([t, r]) => `${t}:${r}`).sort()), got.join(' '));
const says = new Map(flagged.map(([t, r, s]) => [`${t}:${r}`, s]));
check('with what it is held to',
  says.get('ql_over:ql_over') === 'QL 140 over 100' && says.get('ql_nan:ql_over') === 'QL NaN over 100'
    && says.get('count_over:count_over') === 'count 2000000 over 1000000' && says.get('count_over_one:count_over') === 'count 1001 over 1000'
    && says.get('dmg:dmg') === 'damage 120, 0 to 100' && /^QL 60 over \d+(\.\d+)?, best of Ines$/.test(says.get('ql_maker:ql_maker') ?? '')
    && says.get('no_def:no_def') === 'no such thing: no_such_thing' && says.get('rare_unknown:rare_unknown') === 'rarity mythic: no such rarity'
    && says.get('rare_no_roll:rare_no_roll') === 'rarity rare, made by sql',
  [...says].map(([k, v]) => `${k}=${v}`).join('; '));
check('and the good things beside them are not', line('good')[0] === '0', line('good').join(' '));
check('and nothing on the island is changed', line('unchanged')[0] === 'true');
const reports = line('report').map((r) => r.split('|'));
check('what is new is one report to the keepers, by the island, about the holder, naming each thing',
  reports.length === 1 && reports[0][0] === JOSS && reports[0][1] === 'item'
    && reports[0][2].startsWith('Impossible items: 12 · ') && reports[0][2].length <= 200,
  reports.map((r) => r.join(' | ')).join(' / '));
check('the report\'s reason has its label', reportReason('item') === 'Impossible item');
check('a second sweep finds them again and adds no flag and no report',
  Number(first.new) >= 12 && line('again')[0] === '12,12' && line('reports')[0] === '1', `${line('first')} ${line('again')}`);
check(`a sweep reads at most sweep_rows() rows (${line('rows')[0]})`, Number(first.rows) <= Number(line('rows')[0]),
  line('first').join(' '));

// The batching: a sweep of a few rows goes on where it stopped, and back to the start at the end.
const batches = psql(`
begin;
insert into private.item_sweep_mark (one) values (true) on conflict (one) do nothing;
update private.item_sweep_mark set last_id = (select id from item order by id desc offset 3 limit 1);
select private.item_sweep(2)->>'rows';
select (select last_id from private.item_sweep_mark) = (select id from item order by id desc offset 1 limit 1);
select private.item_sweep(2)->>'rows';
select last_id from private.item_sweep_mark;
rollback;`).split('\n').join(',');
check('the sweep reads its batch, goes on from where it stopped, and back to the first at the end', batches === '2,t,1,0', batches);

/* ---- the hold ------------------------------------------------------------------- */
console.log('--- the hold');
const rope = psql(`select id from item where world_id = ${W_} and holder_uid = '${JOSS}' and def = 'rope' order by id limit 1;`);
const holdOf = (who: string, hold: boolean): Ran => as(who, `select rpc_owner_quarantine_item(${W_}, ${rope}, ${hold});`);
const refused = [INES, JOSS].map((u) => holdOf(u, true)).filter((r) => /only a keeper/.test(r.err)).length;
check('only a keeper may take a thing out of play', refused === 2
  && psql(`select holder from item where id = ${rope};`) === 'player');
check('nor anybody signed in as nobody', /permission denied|only a keeper/.test(anon(`select rpc_owner_quarantine_item(${W_}, ${rope}, true);`).err));
check('or list the findings', /only a keeper/.test(as(JOSS, `select rpc_owner_item_flags(${W_});`).err));
psql(`delete from caller where uid = '${HALE}';`);
const held = holdOf(HALE, true);
check('a keeper may', !held.err && JSON.parse(held.out).held === true, held.err || held.out);
check('held, it is held by nobody and seen by no browser',
  psql(`select holder || '|' || coalesce(holder_uid::text, '-') from item where id = ${rope};`) === 'quarantine|-'
    && as(JOSS, `select count(*) from item where id = ${rope};`).out === '0');
check('and held once', /Already held/.test(holdOf(HALE, true).out));
const back = holdOf(HALE, false);
check('put back, it is where it was', !back.err && JSON.parse(back.out).to === 'where it was'
  && psql(`select holder || '|' || holder_uid from item where id = ${rope};`) === `player|${JOSS}`, back.err || back.out);
const listed = as(HALE, `select rpc_owner_item_flags(${W_});`);
check('a keeper may list the findings', !listed.err && Array.isArray(JSON.parse(listed.out).flags), listed.err);
const trail = psql(`select string_agg(what, ' ' order by n) from private.owner_log where world_id = ${W_} and owner = '${HALE}';`);
check('each is written in the trail', trail === 'item_hold item_release item_flags', trail);
check('and nobody else wrote anything', psql(`select count(*) from private.owner_log where world_id = ${W_} and owner <> '${HALE}';`) === '0');

/* ---- work rate ------------------------------------------------------------------ */
console.log('--- work rate');
/** Goes of an action by somebody, each due `gap` seconds after the last, each putting a sprout in their pack. */
const goes = (who: string, act: string, n: number, gap: number): string => `
do $$
declare i int; t0 double precision := extract(epoch from now());
begin
  perform set_config('wurm.source', 'act:${act}', true);
  perform set_config('wurm.uid', '${who}', true);
  for i in 1..${n} loop
    perform set_config('wurm.go_at', (t0 - ${n * gap} + i * ${gap})::text, true);
    perform give(${W_}, '${who}', 'sprout', 1, 30);
  end loop;
  perform set_config('wurm.source', '', true);
  perform set_config('wurm.uid', '', true);
  perform set_config('wurm.go_at', '', true);
end $$;`;
const floor = Number(psql(`select private.watch_go_floor('forage');`));
psql(`delete from private.watch_made_new where world_id = ${W_};
${goes(INES, 'forage', 20, 0.5)}
${goes(JOSS, 'forage', 20, floor)}`);
psql('select private.watch_rates();');
const rates = psql(`select uid || '|' || detail::text from private.watch_flag where world_id = ${W_} and kind = 'rate' order by n;`)
  .split('\n').filter((r) => r);
const ines = rates.filter((r) => r.startsWith(INES)).map((r) => JSON.parse(r.slice(INES.length + 1)) as Record<string, unknown>);
check(`twenty forages due half a second apart are flagged: over ${WATCH_RATE_TIMES} times the most a minute holds`,
  ines.length === 1 && ines[0].kind === 'gather' && ines[0].act === 'forage' && ines[0].goes === 20
    && Number(ines[0].per_min) === 120 && Number(ines[0].most) === Math.round(600 / floor) / 10 && Number(ines[0].times) > WATCH_RATE_TIMES,
  rates.join(' '));
check('and twenty due at the pace are not', !rates.some((r) => r.startsWith(JOSS)), rates.join(' '));
const said = flagLine({ n: 1, kind: 'rate', uid: INES, name: 'Ines', ago: 0, seen: false, detail: ines[0] ?? {} } as WatchFlag);
check('the window says the numbers', flagLabel('rate') === 'Work rate'
  && said === `Gathering, forage: 20 goes in 9.5 s · 120/min, ${Math.round(600 / floor) / 10}/min possible · ${ines[0]?.times}×`, said);
psql('select private.watch_rates();');
check('a rate is flagged once an hour', psql(`select count(*) from private.watch_flag where world_id = ${W_} and kind = 'rate';`) === '1');
check(`fewer than ${WATCH_RATE_LEAST} goes are not measured`, psql(`select private.watch_rate_least();`) === String(WATCH_RATE_LEAST)
  && psql(`select private.watch_rate_times();`) === String(WATCH_RATE_TIMES));
// A backlog: twenty goes due at the pace, settled in one call.
psql(`delete from private.watch_made_new where world_id = ${W_};
delete from private.watch_flag where world_id = ${W_} and kind = 'rate';
select give(${W_}, '${INES}', 'log', 30, 40, 'Oak') \\g /dev/null
update player set body_at = now(), stats = ${BODY} where world_id = ${W_} and uid = '${INES}';
select set_config('request.jwt.claims', '${JSON.stringify({ sub: INES })}', false) \\g /dev/null
delete from caller where uid = '${INES}';
select rpc_act(${W_}, 'make_planks', ${LOG}, 20) \\g /dev/null
update player set act_started = act_started - interval '1 hour', act_ends = act_ends - interval '1 hour'
 where world_id = ${W_} and uid = '${INES}';
select settle(${W_}, '${INES}') \\g /dev/null
select set_config('request.jwt.claims', '', false) \\g /dev/null`);
const backlog = psql(`select count(distinct go_at) || '|' || count(distinct uid) from private.watch_made_new
  where world_id = ${W_} and source = 'act:make_planks';`);
psql('select private.watch_rates();');
check('a backlog of goes settled at once is not flagged: each is measured by when it was due',
  Number(backlog.split('|')[0]) >= WATCH_RATE_LEAST && backlog.split('|')[1] === '1'
    && psql(`select count(*) from private.watch_flag where world_id = ${W_} and kind = 'rate';`) === '0', backlog);
check('the sweep reads the rates before it folds the ledger',
  /watch_rates\(\);\s*\n\s*v_folded := private\.watch_merge\(\)/.test(psql(`select pg_get_functiondef('private.watch_sweep()'::regprocedure);`)));

/* ---- shut to browsers ----------------------------------------------------------- */
console.log('--- shut');
const tables = ['item_flag', 'item_sweep_mark', 'item_quarantine'];
const read = tables.filter((t) => !as(INES, `select count(*) from private.${t};`).err);
check('no browser can read any of the tables', read.length === 0, read.join(' '));
const helpers = ['item_sweep()', 'watch_rates()', `item_ql_ceiling('${W}', 'awl', 'Ines', null)`, `origin_kind('sql')`, 'watch_uid()']
  .filter((h) => !as(INES, `select private.${h};`).err);
check('or call the helpers', helpers.length === 0, helpers.join(' '));

psql(CLEAN);
for (const l of [...ok, ...bad]) console.log(l);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`where things come from — ${ok.length} of ${ok.length}`);
