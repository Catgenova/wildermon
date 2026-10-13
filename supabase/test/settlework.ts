/**
 * Work a settlement wants, delivered by its citizens, and its ledger.
 *
 * The founder, and every rank holding Set work, lists what the settlement
 * wants: a kind of thing, how many, and a lowest quality or none. Any citizen
 * standing within `DELIVER_REACH` tiles of the token delivers toward it: what
 * matches in their pack goes into the founder's deed crate, lowest quality
 * first, until the work has all it wants or the crate is full, and every
 * delivery is a line in the settlement's ledger. This holds:
 *
 *   * the limits are the same on both sides (`work_open_max`,
 *     `work_count_max`, `work_ql_top`, `deliver_reach`, `work_done_keep`,
 *     `ledger_keep`), and so are the words of the new power;
 *   * a Builder may not set or take down work, a Mayor may, a Builder given
 *     Set work may; a stranger may not set, deliver or read;
 *   * every refusal of a work -- no such thing, coins, a crate, too few, too
 *     many, a quality past the top, more open than a settlement may have --
 *     is the browser's `workSetRefusal`, word for word;
 *   * delivering takes the lowest quality at or over the work's least first,
 *     splits a stack for the last few, leaves what is too poor, and refuses
 *     too poor, too far, no deed crate and a full one in the browser's
 *     `deliverRefusal` words;
 *   * what is delivered is moved, not copied: the same rows are in the crate,
 *     a split stack's two halves add up to what it was, and the count of the
 *     thing across pack and crate does not change;
 *   * nothing worn, kept back or holding something goes;
 *   * each delivery is credited in the ledger to whoever made it, and the
 *     browser's `deliveredBy` reads it off the island's answer per citizen;
 *   * a work that has all it wants closes, is written in the ledger as done,
 *     and the founder and whoever set it are told; a closed work takes no
 *     more;
 *   * taking a work down closes it and is written in the ledger;
 *   * no browser can read the tables.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import '../../src/game/game';
import { itemDef } from '../../src/game/items';
import { lacksSaid, POWER } from '../../src/game/ranks';
import {
  deliveredBy, deliverRefusal, DELIVER_REACH, LEDGER_KEEP, settleLine, WORK_COUNT_MAX, WORK_DONE_KEEP, WORK_OPEN_MAX, WORK_QL_TOP,
  workSetRefusal, type SettleBoard,
} from '../../src/game/noticeboard';
import { workLabel } from '../../src/ui/panels/deed';

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

console.log('--- the limits, on both sides');
const limits = psql(`select work_open_max() || '|' || work_count_max() || '|' || work_ql_top() || '|' || deliver_reach()
  || '|' || work_done_keep() || '|' || ledger_keep()`);
check('how many open, how many asked, how good, how near, and how much is kept are the same on both sides',
  limits === [WORK_OPEN_MAX, WORK_COUNT_MAX, WORK_QL_TOP, DELIVER_REACH, WORK_DONE_KEEP, LEDGER_KEEP].join('|'), limits);
check('Set work is a power on the island, at its bit, in the same words',
  psql(`select bit || '|' || may || '|' || may_not || '|' || power_bit('work') from rank_power where id = 'work'`)
    === `${POWER.work.bit}|${POWER.work.may}|${POWER.work.mayNot}|${1 << POWER.work.bit}`);

// The things worked with: a stack of iron lumps and hatchets, which do not stack.
const LUMP = 'iron_lump';
const HATCHET = 'hatchet';
const lump = itemDef(LUMP).name;
const hatchet = itemDef(HATCHET).name;

const out = psql(`
begin;
create temp table said (k text);
do $$
declare w uuid; boss uuid; f uuid[]; may uuid; bld uuid; gst uuid; stranger uuid; dname text; dx int; dy int;
        r_builder bigint; cr crate; v_a bigint; v_b bigint; v_c bigint; v_d bigint; i int;
        l20 bigint; l40 bigint; l50 bigint; h1 bigint; h2 bigint; h3 bigint; h4 bigint; j jsonb;
        v_units_before int; v_units_after int;
begin
  select id into w from world where name = 'Hoarding';
  select founded_by, name, x, y into boss, dname, dx, dy from deed where world_id = w order by founded_at limit 1;
  select array_agg(q.uid order by q.uid) into f from (
    select p.uid from player p where p.world_id = w and p.uid <> boss
       and not exists (select 1 from deed d where d.world_id = w and d.founded_by = p.uid)
     order by p.uid limit 4) q;
  may := f[1]; bld := f[2]; gst := f[3]; stranger := f[4];
  delete from deed_member where world_id = w and uid = any(f);
  delete from deed_member where world_id = w and founder = boss;
  delete from deed_work where world_id = w;
  delete from deed_ledger where world_id = w;
  delete from caller;
  insert into deed_member (world_id, founder, uid, role) values (w, boss, may, 'mayor'), (w, boss, bld, 'builder'), (w, boss, gst, 'guest');
  select id into r_builder from deed_rank_def where world_id = w and founder = boss and name = 'Builder';
  -- An empty deed crate, everybody standing on the token, nothing of either thing in anybody's pack.
  perform place_deed_crate(w, boss);
  cr := deed_crate(w, boss);
  delete from item where world_id = w and holder = 'crate' and crate = cr.id;
  update player set x = dx + 0.5, y = dy + 0.5, equipped = '{}'::jsonb where world_id = w and uid in (boss, may, bld, gst, stranger);
  delete from item where world_id = w and holder = 'player' and holder_uid in (boss, may, bld, gst, stranger)
    and def in ('${LUMP}', '${HATCHET}');
  insert into said values ('DEED|' || dname), ('X|' || dx), ('Y|' || dy), ('N_BLD|' || folk_name(w, bld)),
    ('N_MAY|' || folk_name(w, may)), ('BLD|' || bld), ('MAY|' || may), ('ROOM|' || crate_spare(w, cr));

  -- Who may set work.
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('BLD_SET|' || coalesce(rpc_work_set(w, boss, '${LUMP}', 5)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', stranger)::text, true);
  insert into said values ('STR_SET|' || coalesce(rpc_work_set(w, boss, '${LUMP}', 5)->>'why', 'ALLOWED'));
  insert into said values ('STR_READ|' || coalesce(rpc_settlement(w, boss)->>'why', 'ALLOWED'));

  -- What a work may be, asked by the mayor.
  perform set_config('request.jwt.claims', json_build_object('sub', may)::text, true);
  insert into said values ('NO_THING|' || coalesce(rpc_work_set(w, boss, 'no_such_thing', 5)->>'why', 'ALLOWED'));
  insert into said values ('COIN|' || coalesce(rpc_work_set(w, boss, 'coin', 5)->>'why', 'ALLOWED'));
  insert into said values ('CRATE|' || coalesce(rpc_work_set(w, boss, 'crate_plank', 1)->>'why', 'ALLOWED'));
  insert into said values ('ZERO|' || coalesce(rpc_work_set(w, boss, '${LUMP}', 0)->>'why', 'ALLOWED'));
  insert into said values ('MANY|' || coalesce(rpc_work_set(w, boss, '${LUMP}', work_count_max() + 1)->>'why', 'ALLOWED'));
  insert into said values ('QL|' || coalesce(rpc_work_set(w, boss, '${LUMP}', 5, work_ql_top() + 1)->>'why', 'ALLOWED'));
  v_a := (rpc_work_set(w, boss, '${LUMP}', 5, 30)->>'set')::bigint;
  v_b := (rpc_work_set(w, boss, '${LUMP}', 2, 60)->>'set')::bigint;
  v_c := (rpc_work_set(w, boss, '${HATCHET}', 2)->>'set')::bigint;
  insert into said values ('A|' || v_a), ('B|' || v_b), ('C|' || v_c);

  -- The builder's pack: lumps at QL 20, 40 and 50; four hatchets, one worn, one kept back, one holding a lump.
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', bld, '${LUMP}', 20, 3) returning id into l20;
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', bld, '${LUMP}', 40, 4) returning id into l40;
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', bld, '${LUMP}', 50, 2) returning id into l50;
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', bld, '${HATCHET}', 30, 1) returning id into h1;
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', bld, '${HATCHET}', 30, 1) returning id into h2;
  insert into item (world_id, holder, holder_uid, def, ql, count, locked) values (w, 'player', bld, '${HATCHET}', 30, 1, true) returning id into h3;
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', bld, '${HATCHET}', 30, 1) returning id into h4;
  insert into item (world_id, holder, holder_uid, inside, def, ql, count) values (w, 'bag', bld, h4, '${LUMP}', 10, 1);
  update player set equipped = jsonb_build_object('right', h2::text) where world_id = w and uid = bld;
  insert into said values ('L20|' || l20), ('L40|' || l40), ('L50|' || l50), ('H1|' || h1);
  select coalesce(sum(count), 0) into v_units_before from item where world_id = w and def = '${LUMP}'
    and ((holder = 'player' and holder_uid = bld) or (holder = 'crate' and crate = cr.id));

  -- The builder delivers: refused too far, then too poor, then a stack and a split one toward A.
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  update player set x = dx + 0.5 + deliver_reach() + 1 where world_id = w and uid = bld;
  insert into said values ('FAR|' || coalesce(rpc_work_deliver(w, boss, v_a)->>'why', 'ALLOWED'));
  update player set x = dx + 0.5 + deliver_reach() where world_id = w and uid = bld;
  insert into said values ('POOR|' || coalesce(rpc_work_deliver(w, boss, v_b)->>'why', 'ALLOWED'));
  insert into said values ('BOARD_BEFORE|' || rpc_settlement(w, boss)::text);
  insert into said values ('GIVE_A|' || rpc_work_deliver(w, boss, v_a)::text);
  insert into said values ('TOLD_BLD|' || (select text from event where world_id = w and uid = bld order by n desc limit 1));
  insert into said values ('TOLD_BLD2|' || (select text from event where world_id = w and uid = bld order by n desc offset 1 limit 1));
  insert into said values ('TOLD_BOSS|' || (select string_agg(text, '~' order by n) from (select text, n from event
    where world_id = w and uid = boss order by n desc limit 2) q));
  insert into said values ('A_ROW|' || (select got || ',' || want || ',' || coalesce(how, 'open') from deed_work where world_id = w and id = v_a));
  insert into said values ('L40_AT|' || (select holder || ',' || coalesce(crate, -1) || ',' || count from item where id = l40));
  insert into said values ('L50_AT|' || (select holder || ',' || count from item where id = l50));
  insert into said values ('L50_SPLIT|' || (select count(*) || ',' || coalesce(sum(count), 0) || ',' || coalesce(min(ql), 0) from item
    where world_id = w and holder = 'crate' and crate = cr.id and def = '${LUMP}' and id not in (l40)));
  insert into said values ('L20_AT|' || (select holder || ',' || count from item where id = l20));
  select coalesce(sum(count), 0) into v_units_after from item where world_id = w and def = '${LUMP}'
    and ((holder = 'player' and holder_uid = bld) or (holder = 'crate' and crate = cr.id));
  insert into said values ('UNITS|' || v_units_before || ',' || v_units_after);
  insert into said values ('A_AGAIN|' || coalesce(rpc_work_deliver(w, boss, v_a)->>'why', 'ALLOWED'));

  -- Hatchets toward C: only the one free hatchet goes. Then the mayor delivers the second.
  insert into said values ('GIVE_C|' || rpc_work_deliver(w, boss, v_c)::text);
  insert into said values ('H_AT|' || (select string_agg(holder, ',' order by id) from item where id in (h1, h2, h3, h4)));
  perform set_config('request.jwt.claims', json_build_object('sub', may)::text, true);
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', may, '${HATCHET}', 45, 1);
  insert into said values ('GIVE_C2|' || rpc_work_deliver(w, boss, v_c)::text);
  insert into said values ('TOLD_SETTER|' || (select text from event where world_id = w and uid = may order by n desc limit 1));

  -- A stranger may not deliver.
  perform set_config('request.jwt.claims', json_build_object('sub', stranger)::text, true);
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', stranger, '${LUMP}', 90, 2);
  insert into said values ('STR_GIVE|' || coalesce(rpc_work_deliver(w, boss, v_b)->>'why', 'ALLOWED'));
  insert into said values ('STR_KEPT|' || (select sum(count) from item where world_id = w and holder = 'player' and holder_uid = stranger and def = '${LUMP}'));

  -- The crate full, then gone.
  perform set_config('request.jwt.claims', json_build_object('sub', gst)::text, true);
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', gst, '${LUMP}', 70, 2);
  insert into item (world_id, holder, crate, gx, gy, def, ql, count)
    values (w, 'crate', cr.id, cr.x, cr.y, 'rock_shards', 10, crate_spare(w, cr));
  insert into said values ('FULL|' || coalesce(rpc_work_deliver(w, boss, v_b)->>'why', 'ALLOWED'));
  insert into said values ('FULL_BOARD|' || rpc_settlement(w, boss)::text);
  delete from item where world_id = w and holder = 'crate' and crate = cr.id and def = 'rock_shards';
  insert into said values ('GIVE_B|' || coalesce(rpc_work_deliver(w, boss, v_b)->>'got', 'REFUSED'));
  delete from item where world_id = w and holder = 'crate' and crate = cr.id;
  delete from crate where world_id = w and id = cr.id;
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', gst, '${LUMP}', 70, 2);
  perform set_config('request.jwt.claims', json_build_object('sub', may)::text, true);
  v_d := (rpc_work_set(w, boss, '${LUMP}', 9)->>'set')::bigint;
  perform set_config('request.jwt.claims', json_build_object('sub', gst)::text, true);
  insert into said values ('NOCRATE|' || coalesce(rpc_work_deliver(w, boss, v_d)->>'why', 'ALLOWED'));
  insert into said values ('NOCRATE_KEPT|' || (select sum(count) from item where world_id = w and holder = 'player' and holder_uid = gst and def = '${LUMP}'));

  -- Taking down: a builder may not, until given Set work.
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('BLD_DROP|' || coalesce(rpc_work_drop(w, boss, v_d)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  perform rpc_rank_allow(w, r_builder, 'work', true);
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('BLD_DROPS|' || coalesce(rpc_work_drop(w, boss, v_d)->>'dropped', 'REFUSED'));
  insert into said values ('DROP_AGAIN|' || coalesce(rpc_work_drop(w, boss, v_d)->>'why', 'ALLOWED'));

  -- The open cap.
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  delete from caller;
  for i in 1 .. work_open_max() loop
    perform rpc_work_set(w, boss, 'log', i);
  end loop;
  insert into said values ('OPEN|' || (select count(*) from deed_work where world_id = w and founder = boss and closed_at is null));
  insert into said values ('CAP|' || coalesce(rpc_work_set(w, boss, 'log', 1)->>'why', 'ALLOWED'));
  insert into said values ('BOARD|' || rpc_settlement(w, boss)::text);

  insert into said values ('SHUT|' || (has_table_privilege('authenticated', 'deed_work', 'select')
    or has_table_privilege('authenticated', 'deed_ledger', 'select') or has_table_privilege('anon', 'deed_ledger', 'select'))::text
    || ',' || (select bool_and(relrowsecurity) from pg_class where relname in ('deed_work', 'deed_ledger'))::text);
end $$;
select string_agg(k, E'\\n') from said;
rollback;
`);
const got = (key: string): string => out.split('\n').find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? '(nothing)';
const deed = got('DEED');
const [dx, dy] = [Number(got('X')), Number(got('Y'))];
const same = (what: string, browser: string | null, island: string): void =>
  check(`${what}, in the same words on both sides`, browser === island && !['ALLOWED', 'REFUSED', '(nothing)'].includes(island),
    `${browser} / ${island}`);

console.log('--- who may set work');
same('a Builder may not set work', lacksSaid(deed, 'Builder', 'work'), got('BLD_SET'));
same('a stranger may not set work', settleLine('stranger', { deed }), got('STR_SET'));
same('nor read the board', settleLine('stranger', { deed }), got('STR_READ'));
check('a Mayor sets three works', [got('A'), got('B'), got('C')].every((v) => /^\d+$/.test(v)), `${got('A')}, ${got('B')}, ${got('C')}`);

console.log('--- what a work may be');
same('no such thing', workSetRefusal(deed, null, false, 5, null, 0), got('NO_THING'));
same('coins', workSetRefusal(deed, itemDef('coin').name, false, 5, null, 0), got('COIN'));
same('a crate', workSetRefusal(deed, itemDef('crate_plank').name, false, 1, null, 0), got('CRATE'));
same('none of it', workSetRefusal(deed, lump, true, 0, null, 0), got('ZERO'));
same(`more than ${WORK_COUNT_MAX}`, workSetRefusal(deed, lump, true, WORK_COUNT_MAX + 1, null, 0), got('MANY'));
same(`a lowest quality past ${WORK_QL_TOP}`, workSetRefusal(deed, lump, true, 5, WORK_QL_TOP + 1, 0), got('QL'));
check(`${WORK_OPEN_MAX} open at once`, got('OPEN') === String(WORK_OPEN_MAX), got('OPEN'));
same('and no more', workSetRefusal(deed, 'Log', true, 1, null, WORK_OPEN_MAX), got('CAP'));

console.log('--- delivering');
const before = JSON.parse(got('BOARD_BEFORE')) as SettleBoard;
const wa = before.work.find((w) => w.id === Number(got('A')))!;
const wb = before.work.find((w) => w.id === Number(got('B')))!;
const far = deliverRefusal(before, wa, lump.toLowerCase(), 6, dx + 0.5 + DELIVER_REACH + 1, dy + 0.5);
same(`further than ${DELIVER_REACH} tiles from the token`, far, got('FAR'));
same('nothing good enough', deliverRefusal(before, wb, lump.toLowerCase(), 0, dx + 0.5, dy + 0.5), got('POOR'));
check(`within ${DELIVER_REACH} tiles the browser lets the builder deliver`, deliverRefusal(before, wa, lump.toLowerCase(), 6, dx + 0.5 + DELIVER_REACH, dy + 0.5) === null);
const giveA = JSON.parse(got('GIVE_A')) as { delivered: number; got: number; want: number; done: boolean };
check('the builder delivers five toward a work of five, and it is done', giveA.delivered === 5 && giveA.got === 5 && giveA.done, got('GIVE_A'));
check('the work is closed as done', got('A_ROW') === '5,5,done', got('A_ROW'));
check('the stack of four at QL 40 went first, whole, into the deed crate', got('L40_AT').startsWith('crate,') && got('L40_AT').endsWith(',4'), got('L40_AT'));
check('one was split off the stack of two at QL 50, and one stays in the pack', got('L50_AT') === 'player,1' && got('L50_SPLIT') === '1,1,50',
  `${got('L50_AT')}; ${got('L50_SPLIT')}`);
check('the three at QL 20, under the work\'s least, stay', got('L20_AT') === 'player,3', got('L20_AT'));
const [ub, ua] = got('UNITS').split(',');
check('moved, not copied: as many lumps across the pack and the crate after as before', ub === ua && Number(ub) === 9, got('UNITS'));
check('the builder is told, in the browser\'s words', got('TOLD_BLD2') === settleLine('delivered', { deed, what: lump.toLowerCase(), n: 5 })
  && got('TOLD_BLD') === settleLine('finished', { deed, what: lump.toLowerCase(), n: 5 }), `${got('TOLD_BLD2')} / ${got('TOLD_BLD')}`);
check('and so is the founder, who did not deliver it',
  got('TOLD_BOSS') === `${settleLine('finished', { deed, what: lump.toLowerCase(), n: 5 })}~${settleLine('deliveredBy', { deed, who: got('N_BLD'), what: lump.toLowerCase(), n: 5 })}`
    || got('TOLD_BOSS') === `${settleLine('deliveredBy', { deed, who: got('N_BLD'), what: lump.toLowerCase(), n: 5 })}~${settleLine('finished', { deed, what: lump.toLowerCase(), n: 5 })}`,
  got('TOLD_BOSS'));
same('a finished work takes no more', settleLine('noWork'), got('A_AGAIN'));
const giveC = JSON.parse(got('GIVE_C')) as { delivered: number; got: number; done: boolean };
check('of four hatchets only the one not worn, kept back or holding something goes', giveC.delivered === 1 && giveC.got === 1 && !giveC.done
  && got('H_AT') === 'crate,player,player,player', `${got('GIVE_C')}; ${got('H_AT')}`);
const giveC2 = JSON.parse(got('GIVE_C2')) as { delivered: number; got: number; done: boolean };
check('the mayor delivers the second, and the work is done', giveC2.delivered === 1 && giveC2.done, got('GIVE_C2'));
check('whoever set it is told', got('TOLD_SETTER') === settleLine('finished', { deed, what: hatchet.toLowerCase(), n: 2 }), got('TOLD_SETTER'));
same('a stranger may not deliver', settleLine('stranger', { deed }), got('STR_GIVE'));
check('and keeps what they carry', got('STR_KEPT') === '2', got('STR_KEPT'));
const fullBoard = JSON.parse(got('FULL_BOARD')) as SettleBoard;
same('a full deed crate', deliverRefusal(fullBoard, fullBoard.work.find((w) => w.id === Number(got('B')))!, lump.toLowerCase(), 2, dx + 0.5, dy + 0.5), got('FULL'));
check('with room again, the guest\'s two at QL 70 finish the work of two at QL 60', got('GIVE_B') === '2', got('GIVE_B'));
same('no deed crate', settleLine('noCrate', { deed }), got('NOCRATE'));
check('and nothing left the pack', got('NOCRATE_KEPT') === '2', got('NOCRATE_KEPT'));

console.log('--- taking down');
same('a Builder may not take work down', lacksSaid(deed, 'Builder', 'work'), got('BLD_DROP'));
check('given Set work, a Builder takes one down', /^\d+$/.test(got('BLD_DROPS')), got('BLD_DROPS'));
same('asked again, it is already closed', settleLine('noWork'), got('DROP_AGAIN'));

console.log('--- the ledger');
const board = JSON.parse(got('BOARD')) as SettleBoard;
const a = Number(got('A'));
const c = Number(got('C'));
const lineFor = (work: number, what: string) => board.ledger.filter((l) => l.work === work && l.what === what);
check('a work set is a line, by whoever set it', lineFor(a, 'set').length === 1 && lineFor(a, 'set')[0].by === got('N_MAY') && lineFor(a, 'set')[0].count === 5);
check('a delivery is a line: who, how many, of what, at what average quality, toward which work',
  lineFor(a, 'delivered').length === 1 && lineFor(a, 'delivered')[0].uid === got('BLD') && lineFor(a, 'delivered')[0].count === 5
    && lineFor(a, 'delivered')[0].def === LUMP && lineFor(a, 'delivered')[0].ql === 42,
  JSON.stringify(lineFor(a, 'delivered')));
check('and the work done is a line', lineFor(a, 'done').length === 1 && lineFor(a, 'done')[0].count === 5);
const byWho = deliveredBy(board.ledger, c);
check('the browser credits each citizen what they delivered toward a work, read off the island\'s ledger',
  byWho.length === 2 && byWho.every((x) => x.count === 1) && byWho.some((x) => x.uid === got('BLD')) && byWho.some((x) => x.uid === got('MAY')),
  JSON.stringify(byWho));
check('a work taken down is a line', board.ledger.some((l) => l.what === 'dropped' && l.work === Number(got('BLD_DROPS')) && l.by === got('N_BLD')));
check('newest first', board.ledger.every((l, i, all) => i === 0 || all[i - 1].n > l.n));
check('the board lists open work first, oldest first, then the closed, with progress',
  board.work.filter((w) => w.closed === null).length === WORK_OPEN_MAX
    && board.work.findIndex((w) => w.closed !== null) === WORK_OPEN_MAX
    && board.work.find((w) => w.id === a)?.how === 'done' && board.work.find((w) => w.id === a)?.got === 5,
  board.work.map((w) => `${w.id}:${w.how ?? 'open'}`).join(' '));
check('a work reads by its number, how many of what and how good', workLabel(wa) === `#${wa.id} · 5 × ${lump.toLowerCase()}, QL 30+`, workLabel(wa));
check('no browser reads the tables, and row security is on', got('SHUT') === 'false,true', got('SHUT'));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`work a settlement wants, and its ledger — ${ok.length} of ${ok.length}`);
