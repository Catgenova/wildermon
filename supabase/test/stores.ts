/**
 * Shared settlement stores.
 *
 * A crate or a piece of storage furniture on a settlement may be marked one of
 * its stores by its founder or a rank holding Keep the stores. Then it opens
 * for the founder and the ranks holding Use the stores, padlock or not, and
 * for nobody else, key or not; only whoever set it down and the founder move
 * it; crafting never draws on it; and every take and put goes in a log of the
 * settlement's last `STORE_LOG_CAP`. This asks, of the island and of the
 * browser together:
 *
 *   * the cap, and which pieces of furniture may be a store, are the same on
 *     both sides;
 *   * marking and unmarking: refused to a citizen without Keep the stores, a
 *     stranger, a store on no settlement, a stall, and twice over; allowed to
 *     a rank holding it and to the founder;
 *   * a citizen whose rank holds Use the stores takes from and puts into a
 *     padlocked store without the key -- a crate and a chest, refused and
 *     performed -- and the browser lets them;
 *   * a citizen without it, and a stranger holding the key, are refused, in
 *     the same words on both sides, and a go started before is refused when
 *     it lands;
 *   * the log: who, what, how many and whether a put, newest first, read by
 *     the founder and Keep the stores only, and never longer than the cap;
 *   * picking up and turning are for whoever set it down and the founder;
 *   * a craft does not draw on a store, and disbanding unmarks them.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { Game, type Deed } from '../../src/game/game';
import { crateShut, type PlacedCrate } from '../../src/game/crates';
import { FURNITURE, pieceShut, type PlacedFurniture } from '../../src/game/furniture';
import { DEFAULT_RANKS, lacksSaid, permsOf, powerBit, STORE_LOG_CAP } from '../../src/game/ranks';
import {
  STORE_NOT_MARKABLE, STORE_UNSETTLED, storeLogLine, storeMarkable, storeMarkRefusal, storeMoveRefusal, storeMoveSaid,
  storeStrangerSaid, storeUse, type StoreLogEntry,
} from '../../src/game/stores';

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

/* ---- the rule, on both sides ------------------------------------------------ */

console.log('--- the cap and what may be a store');
check('the log keeps the same number on both sides', psql('select store_log_cap()') === String(STORE_LOG_CAP),
  `${psql('select store_log_cap()')} / ${STORE_LOG_CAP}`);
const islandMarkable = psql(`select string_agg(f.id, ',' order by f.id) from furniture_def f
  where store_markable_refusal(jsonb_populate_record(null::placed, jsonb_build_object('kind', 'furniture', 'sub', f.id))) is null`);
const browserMarkable = FURNITURE.filter((f) => storeMarkable(f.id, f)).map((f) => f.id).sort().join(',');
check('the same pieces of furniture may be a settlement store on both sides', islandMarkable === browserMarkable,
  `${islandMarkable}\n---\n${browserMarkable}`);
check('and a stall, a trash crate, a mailbox and a cart are not among them',
  ['stall', 'trash_crate', 'mailbox', 'cart', 'wagon', 'rowing_boat'].every((k) => !browserMarkable.split(',').includes(k))
  && ['chest', 'cupboard', 'larder', 'craft_bin'].every((k) => browserMarkable.split(',').includes(k)), browserMarkable);

/* ---- the island ------------------------------------------------------------- */

const out = psql(`
begin;
create temp table said (k text);
do $$
declare w uuid; boss uuid; f uuid[]; keeper uuid; porter uuid; plain uuid; stranger uuid;
        dname text; dx int; dy int; r_keep bigint; r_porter bigint; r_builder bigint;
        v_lock bigint; v_crate int := 9400; v_far int := 9401; v_chest bigint; v_stall bigint;
        v_log bigint; v_pack bigint; j jsonb; i int; v_ord int;
begin
  select id into w from world where name = 'Hoarding';
  select founded_by, name, x, y into boss, dname, dx, dy from deed where world_id = w order by founded_at limit 1;
  select array_agg(q.uid order by q.uid) into f from (
    select p.uid from player p where p.world_id = w and p.uid <> boss
       and not exists (select 1 from deed d where d.world_id = w and d.founded_by = p.uid)
     order by p.uid limit 4) q;
  keeper := f[1]; porter := f[2]; plain := f[3]; stranger := f[4];
  delete from deed_member where world_id = w and uid = any(f);
  delete from deed_invite where world_id = w and uid = any(f);
  delete from caller;
  select coalesce(max(ord), 0) into v_ord from deed_rank_def where world_id = w and founder = boss;
  insert into deed_rank_def (world_id, founder, name, ord, perms)
    values (w, boss, 'Storekeep', v_ord + 1, power_bits(array['keep_stores'])) returning id into r_keep;
  insert into deed_rank_def (world_id, founder, name, ord, perms)
    values (w, boss, 'Porter', v_ord + 2, power_bits(array['use_stores'])) returning id into r_porter;
  select id into r_builder from deed_rank_def where world_id = w and founder = boss and name = 'Builder';
  insert into deed_member (world_id, founder, uid, rank_id) values (w, boss, keeper, r_keep), (w, boss, porter, r_porter),
    (w, boss, plain, r_builder);
  update player set body_at = now(), x = dx + 1.5, y = dy + 0.5, level = 0 where world_id = w and uid in (boss, keeper, porter, plain, stranger);
  insert into said values ('DEED|' || dname), ('BOSS|' || boss), ('X|' || dx), ('Y|' || dy),
    ('N_PORTER|' || folk_name(w, porter)), ('N_BOSS|' || folk_name(w, boss));

  -- A padlocked log crate the keeper set down, with five logs in it, and a key to it in the stranger's pack.
  delete from crate where world_id = w and id in (v_crate, v_far);
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', keeper, 'padlock', 40, 1) returning id into v_lock;
  delete from item where id = v_lock;
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by, lock) values (w, v_crate, 'log', dx + 1, dy, 0, 0, keeper, v_lock);
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', v_crate, 'log', 30, 5) returning id into v_log;
  insert into item (world_id, holder, holder_uid, def, ql, count, keyed) values (w, 'player', stranger, 'key', 40, 1, v_lock),
    (w, 'player', keeper, 'key', 40, 1, v_lock);
  -- And a crate out in the country, on no settlement.
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by) values (w, v_far, 'log', dx + 400, dy + 400, 0, 0, keeper);
  insert into said values ('FAR_COVERED|' || (select count(*) from deed_covering(w, dx + 400, dy + 400)));
  -- A padlocked chest the keeper set down beside it, and a stall.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, made_by, lock)
    values (w, 'furniture', 'chest', dx, dy, 0, 0, dx + 0.5, dy + 0.5, keeper, v_lock + 1) returning id into v_chest;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, made_by)
    values (w, 'furniture', 'stall', dx, dy + 1, 0, 0, dx + 0.5, dy + 1.5, keeper) returning id into v_stall;
  insert into said values ('CRATE_NAME|' || crate_name((select c from crate c where world_id = w and id = v_crate))),
    ('CHEST_NAME|' || placed_name((select p from placed p where id = v_chest)));

  -- ---- marking: who may, and what
  perform set_config('request.jwt.claims', json_build_object('sub', plain)::text, true);
  insert into said values ('MARK_PLAIN|' || coalesce(rpc_store_mark(w, 'crate', v_crate, true)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', stranger)::text, true);
  insert into said values ('MARK_STRANGER|' || coalesce(rpc_store_mark(w, 'crate', v_crate, true)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', keeper)::text, true);
  insert into said values ('MARK_FAR|' || coalesce(rpc_store_mark(w, 'crate', v_far, true)->>'why', 'ALLOWED'));
  insert into said values ('MARK_STALL|' || coalesce(rpc_store_mark(w, 'furniture', v_stall, true)->>'why', 'ALLOWED'));
  insert into said values ('UNMARK_NONE|' || coalesce(rpc_store_mark(w, 'crate', v_crate, false)->>'why', 'ALLOWED'));
  j := rpc_store_mark(w, 'crate', v_crate, true);
  insert into said values ('MARK|' || coalesce(j->>'why', (j->>'marked') || ':' || (j->>'deed') || ':' || ((j->>'store_of')::uuid = boss)));
  insert into said values ('MARK_AGAIN|' || coalesce(rpc_store_mark(w, 'crate', v_crate, true)->>'why', 'ALLOWED'));
  insert into said values ('MARKED_ROW|' || ((select store_of from crate where world_id = w and id = v_crate) = boss));
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  insert into said values ('UNMARK_BOSS|' || coalesce(rpc_store_mark(w, 'crate', v_crate, false)->>'why', 'UNMARKED'));
  insert into said values ('UNMARKED_ROW|' || coalesce((select store_of::text from crate where world_id = w and id = v_crate), 'NULL'));
  perform set_config('request.jwt.claims', json_build_object('sub', keeper)::text, true);
  perform rpc_store_mark(w, 'crate', v_crate, true);
  insert into said values ('MARK_CHEST|' || coalesce(rpc_store_mark(w, 'furniture', v_chest, true)->>'why', 'ALLOWED'));
  -- The crate on the ground, as the island sends it to a browser.
  insert into said values ('CRATES_NEAR|' || (select x::text from jsonb_array_elements(crates_near(w, porter, 6)) x where (x->>'id')::int = v_crate));

  -- ---- use: a porter holds Use the stores, and neither Crates and stores nor a key
  j := jsonb_build_object('kind', 'crate', 'id', v_crate);
  insert into said values ('PORTER_YOURS|' || crate_yours(w, porter, v_crate) || '|' || lock_shut(w, porter, v_lock, dx + 1, dy));
  insert into said values ('PORTER_TAKEALL|' || coalesce(crate_refusal(w, porter, 'crate_take_all', j), 'ALLOWED'));
  insert into said values ('PORTER_TAKE|' || coalesce(crate_refusal(w, porter, 'take_from_store',
    jsonb_build_object('kind', 'item', 'uid', v_log, 'count', 2)), 'ALLOWED'));
  perform perform_crate(w, porter, 'take_from_store', jsonb_build_object('kind', 'item', 'uid', v_log, 'count', 2));
  insert into said values ('PORTER_TOOK|' || coalesce((select sum(count) from item where world_id = w and holder = 'player'
    and holder_uid = porter and def = 'log'), 0) || '|' || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'crate' and crate = v_crate));
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', porter, 'rock_shards', 20, 3) returning id into v_pack;
  insert into said values ('PORTER_PUT|' || coalesce(crate_refusal(w, porter, 'store_in_crate',
    jsonb_build_object('kind', 'item', 'uid', v_pack, 'into', v_crate, 'count', 3)), 'ALLOWED'));
  perform perform_crate(w, porter, 'store_in_crate', jsonb_build_object('kind', 'item', 'uid', v_pack, 'into', v_crate, 'count', 3));
  insert into said values ('PORTER_PUT_IN|' || coalesce((select sum(count) from item where world_id = w and holder = 'crate'
    and crate = v_crate and def = 'rock_shards'), 0));
  -- The chest: a put and a take-all, padlocked too.
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', porter, 'rock_shards', 20, 4) returning id into v_pack;
  insert into said values ('PORTER_CHEST_PUT|' || coalesce(holding_refusal(w, porter, 'store_in_furniture',
    jsonb_build_object('kind', 'item', 'uid', v_pack, 'into', v_chest, 'count', 4)), 'ALLOWED'));
  perform perform_holding(w, porter, 'store_in_furniture', jsonb_build_object('kind', 'item', 'uid', v_pack, 'into', v_chest, 'count', 4));
  insert into said values ('PORTER_CHEST_IN|' || coalesce((select sum(count) from item where holder = 'furniture' and placed = v_chest), 0));

  -- ---- refused: a citizen without Use the stores, and a stranger with the key
  insert into said values ('PLAIN_TAKEALL|' || coalesce(crate_refusal(w, plain, 'crate_take_all', j), 'ALLOWED'));
  insert into said values ('PLAIN_TAKE|' || coalesce(crate_refusal(w, plain, 'take_from_store',
    jsonb_build_object('kind', 'item', 'uid', v_log, 'count', 1)), 'ALLOWED'));
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', plain, 'rock_shards', 20, 1) returning id into v_pack;
  insert into said values ('PLAIN_PUT|' || coalesce(crate_refusal(w, plain, 'store_in_crate',
    jsonb_build_object('kind', 'item', 'uid', v_pack, 'into', v_crate, 'count', 1)), 'ALLOWED'));
  insert into said values ('PLAIN_CHEST|' || coalesce(holding_refusal(w, plain, 'furniture_take_all',
    jsonb_build_object('kind', 'furniture', 'id', v_chest)), 'ALLOWED'));
  -- A go that started and lands: nothing comes out.
  perform perform_crate(w, plain, 'crate_take_all', j);
  insert into said values ('PLAIN_GOT|' || coalesce((select sum(count) from item where world_id = w and holder = 'player'
    and holder_uid = plain and def = 'log'), 0) || '|' || (select text from event where world_id = w and uid = plain order by n desc limit 1));
  insert into said values ('STRANGER_TAKEALL|' || lock_shut(w, stranger, v_lock, dx + 1, dy) || '|'
    || coalesce(crate_refusal(w, stranger, 'crate_take_all', j), 'ALLOWED'));
  insert into said values ('STRANGER_TAKE|' || coalesce(crate_refusal(w, stranger, 'take_from_store',
    jsonb_build_object('kind', 'item', 'uid', v_log, 'count', 1)), 'ALLOWED'));
  insert into said values ('STRANGER_CHEST|' || coalesce(holding_refusal(w, stranger, 'furniture_take_all',
    jsonb_build_object('kind', 'furniture', 'id', v_chest)), 'ALLOWED'));
  insert into said values ('STRANGER_NEAREST|' || ((nearest_store(w, stranger, 'rock_shards', 1)).id is distinct from v_chest)
    || '|' || ((nearest_store(w, porter, 'rock_shards', 1)).id is not null));

  -- ---- the founder empties it, and the log
  insert into said values ('BOSS_TAKEALL|' || coalesce(crate_refusal(w, boss, 'crate_take_all', j), 'ALLOWED'));
  perform perform_crate(w, boss, 'crate_take_all', j);
  perform perform_holding(w, boss, 'furniture_take_all', jsonb_build_object('kind', 'furniture', 'id', v_chest));
  insert into said values ('EMPTIED|' || (select count(*) from item where world_id = w and holder = 'crate' and crate = v_crate)
    || '|' || (select count(*) from item where holder = 'furniture' and placed = v_chest));
  perform set_config('request.jwt.claims', json_build_object('sub', keeper)::text, true);
  insert into said values ('LOG|' || (rpc_store_log(w, boss)->'log')::text);
  perform set_config('request.jwt.claims', json_build_object('sub', plain)::text, true);
  insert into said values ('LOG_PLAIN|' || coalesce(rpc_store_log(w, boss)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', stranger)::text, true);
  insert into said values ('LOG_STRANGER|' || coalesce(rpc_store_log(w, boss)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  insert into said values ('LOG_BOSS|' || jsonb_array_length(rpc_store_log(w)->'log'));
  -- The cap: more than it keeps, and the newest kept.
  for i in 1 .. store_log_cap() + 7 loop
    perform store_log_add(w, boss, porter, true, 'log', 'log', i, 'Log crate');
  end loop;
  j := rpc_store_log(w, boss);
  insert into said values ('CAP|' || jsonb_array_length(j->'log') || '|' || (j->'log'->0->>'count') || '|'
    || (j->'log'->(jsonb_array_length(j->'log') - 1)->>'count') || '|' || (j->>'cap'));
  insert into said values ('CAP_ROWS|' || (select count(*) from deed_store_log where world_id = w and founder = boss));
  insert into said values ('LOG_READ|' || has_table_privilege('authenticated', 'deed_store_log', 'select'));

  -- ---- moving: whoever set it down, and the founder
  insert into said values ('PICK_PORTER|' || coalesce(crate_refusal(w, porter, 'pick_up_crate', jsonb_build_object('kind', 'crate', 'id', v_crate)), 'ALLOWED'));
  insert into said values ('PICK_KEEPER|' || coalesce(crate_refusal(w, keeper, 'pick_up_crate', jsonb_build_object('kind', 'crate', 'id', v_crate)), 'ALLOWED'));
  insert into said values ('PICK_BOSS|' || coalesce(crate_refusal(w, boss, 'pick_up_crate', jsonb_build_object('kind', 'crate', 'id', v_crate)), 'ALLOWED'));
  j := jsonb_build_object('kind', 'furniture', 'id', v_chest);
  insert into said values ('LIFT_PORTER|' || coalesce(act_refusal(w, porter, 'pick_up_furniture', j), 'ALLOWED'));
  insert into said values ('TURN_PORTER|' || coalesce(store_move_refusal(w, porter, 'turn_furniture', j), 'ALLOWED'));
  insert into said values ('LIFT_KEEPER|' || coalesce(store_move_refusal(w, keeper, 'pick_up_furniture', j), 'ALLOWED'));
  insert into said values ('LIFT_BOSS|' || coalesce(store_move_refusal(w, boss, 'pick_up_furniture', j), 'ALLOWED'));

  -- ---- a craft does not reach into it, for anybody
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', v_crate, 'log', 30, 2);
  insert into said values ('CRAFT|' || (select count(*) from craft_stock(w, boss) s join item i on i.id = s.id
    where i.holder = 'crate' and i.crate = v_crate) || '|' || (select count(*) from hod_stock(w, boss, 'log', 3) s join item i on i.id = s.id
    where i.holder = 'crate' and i.crate = v_crate));

  -- ---- unmarked, it is an ordinary padlocked crate again: one thing out of it asks the key
  perform set_config('request.jwt.claims', json_build_object('sub', keeper)::text, true);
  perform rpc_store_mark(w, 'crate', v_crate, false);
  insert into said values ('UNMARKED_TAKE|' || coalesce(crate_refusal(w, plain, 'take_from_store',
    jsonb_build_object('kind', 'item', 'uid', (select id from item where holder = 'crate' and crate = v_crate limit 1), 'count', 1)), 'ALLOWED'));
  insert into said values ('UNMARKED_KEY|' || coalesce(crate_refusal(w, keeper, 'take_from_store',
    jsonb_build_object('kind', 'item', 'uid', (select id from item where holder = 'crate' and crate = v_crate limit 1), 'count', 1)), 'ALLOWED'));

  -- ---- disbanding unmarks its stores
  perform rpc_store_mark(w, 'crate', v_crate, true);
  delete from deed where world_id = w and founded_by = boss;
  insert into said values ('DISBANDED|' || coalesce((select store_of::text from crate where world_id = w and id = v_crate), 'NULL')
    || '|' || coalesce((select store_of::text from placed where id = v_chest), 'NULL'));
end $$;
select string_agg(k, E'\\n') from said;
rollback;
`);
const got = (key: string): string => out.split('\n').find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? '(nothing)';
const [deed, boss, nPorter, nBoss] = ['DEED', 'BOSS', 'N_PORTER', 'N_BOSS'].map(got);
const [dx, dy] = [Number(got('X')), Number(got('Y'))];
const crateWhat = got('CRATE_NAME').toLowerCase();
const chestWhat = got('CHEST_NAME').toLowerCase();
const same = (what: string, browser: string | null, island: string): void =>
  check(`${what}, in the same words on both sides`, browser === island && !['ALLOWED', '(nothing)'].includes(island),
    `${browser} / ${island}`);

const game = Game.create(4242);
const builderPerms = permsOf(DEFAULT_RANKS[1].powers);
const home = (rank: string, perms: number): Deed => ({ name: deed, x: dx, y: dy, radius: 8, level: 1, mine: true, role: rank.toLowerCase(), rank, perms });
const crate = (): PlacedCrate => ({ id: 9400, x: dx + 1, y: dy, sx: 0, sy: 0, kind: 'log', items: [], ql: 20, mine: false, lock: 1, storeOf: boss } as PlacedCrate);
const chest = (): PlacedFurniture => ({ id: 1, kind: 'chest', x: dx, y: dy, sx: 0, sy: 0, ql: 20, items: [], mine: false, lock: 2, storeOf: boss } as unknown as PlacedFurniture);

console.log('--- marking');
check('the crate out in the country is on no settlement', got('FAR_COVERED') === '0', got('FAR_COVERED'));
game.deed = home('Builder', builderPerms);
game.neighbourDeeds = [];
same('a citizen whose rank lacks Keep the stores may not mark one', storeMarkRefusal(game, { ...crate(), storeOf: undefined }, crateWhat, true, true), got('MARK_PLAIN'));
check('which is the sentence every power refused says', got('MARK_PLAIN') === lacksSaid(deed, 'Builder', 'keep_stores'), got('MARK_PLAIN'));
game.deed = null;
game.neighbourDeeds = [{ name: deed, x: dx, y: dy, radius: 8, level: 1, holder: null }];
same('nor may a stranger', storeMarkRefusal(game, { ...crate(), storeOf: undefined }, crateWhat, true, true), got('MARK_STRANGER'));
game.deed = home('Storekeep', powerBit('keep_stores'));
game.neighbourDeeds = [];
same('a store on no settlement is nobody\'s to mark', storeMarkRefusal(game, { x: dx + 400, y: dy + 400 }, crateWhat, true, true), got('MARK_FAR'));
check('in the words kept for it', got('MARK_FAR') === STORE_UNSETTLED, got('MARK_FAR'));
same('a stall is no store', storeMarkRefusal(game, { x: dx, y: dy + 1 }, 'market stall', storeMarkable('stall', FURNITURE.find((d) => d.id === 'stall')!), true), got('MARK_STALL'));
check('in the words kept for it', got('MARK_STALL') === STORE_NOT_MARKABLE, got('MARK_STALL'));
same('an unmarked store is not unmarked', storeMarkRefusal(game, { ...crate(), storeOf: undefined }, crateWhat, true, false), got('UNMARK_NONE'));
check('a rank holding Keep the stores marks the padlocked crate, as a store of the settlement it stands on',
  got('MARK') === `true:${deed}:true` && got('MARKED_ROW') === 'true', `${got('MARK')}; ${got('MARKED_ROW')}`);
check('and the browser offers it to them', storeMarkRefusal(game, { ...crate(), storeOf: undefined }, crateWhat, true, true) === null);
same('and not twice', storeMarkRefusal(game, crate(), crateWhat, true, true), got('MARK_AGAIN'));
check('the founder unmarks it', got('UNMARK_BOSS') === 'UNMARKED' && got('UNMARKED_ROW') === 'NULL', `${got('UNMARK_BOSS')}; ${got('UNMARKED_ROW')}`);
check('and a chest is marked as well', got('MARK_CHEST') === 'ALLOWED', got('MARK_CHEST'));
const near = JSON.parse(got('CRATES_NEAR')) as { store_of?: string; mine?: boolean };
check('the island tells a browser which settlement a crate is a store of', near.store_of === boss && near.mine === false, got('CRATES_NEAR'));

console.log('--- a porter, whose rank holds Use the stores and nothing else');
check('neither Crates and stores nor the key would have let them in', got('PORTER_YOURS') === 'false|true', got('PORTER_YOURS'));
check('the padlocked crate opens for them: take everything, take one, put in',
  got('PORTER_TAKEALL') === 'ALLOWED' && got('PORTER_TAKE') === 'ALLOWED' && got('PORTER_PUT') === 'ALLOWED',
  `${got('PORTER_TAKEALL')}; ${got('PORTER_TAKE')}; ${got('PORTER_PUT')}`);
check('two logs come out into their pack and three are left', got('PORTER_TOOK') === '2|3', got('PORTER_TOOK'));
check('three shards go in', got('PORTER_PUT_IN') === '3', got('PORTER_PUT_IN'));
check('and the padlocked chest takes four more from them', got('PORTER_CHEST_PUT') === 'ALLOWED' && got('PORTER_CHEST_IN') === '4',
  `${got('PORTER_CHEST_PUT')}; ${got('PORTER_CHEST_IN')}`);
game.deed = home('Porter', powerBit('use_stores'));
check('and the browser lets them, the padlock and whose it is not asked',
  storeUse(game, crate(), crateWhat) === 'open' && crateShut(game, crate()) === null && pieceShut(game, chest()) === null);

console.log('--- refused');
game.deed = home('Builder', builderPerms);
same('a citizen whose rank lacks Use the stores may not empty it', crateShut(game, crate()), got('PLAIN_TAKEALL'));
check('which is the sentence every power refused says', got('PLAIN_TAKEALL') === lacksSaid(deed, 'Builder', 'use_stores'), got('PLAIN_TAKEALL'));
same('nor take one thing out', crateShut(game, crate()), got('PLAIN_TAKE'));
same('nor put anything in, Crates and stores or not', crateShut(game, crate(), ' to put anything in'), got('PLAIN_PUT'));
same('nor open the chest', pieceShut(game, chest()), got('PLAIN_CHEST'));
check('a take-all that lands after all takes nothing, and says why', got('PLAIN_GOT') === `0|${got('PLAIN_TAKEALL')}`, got('PLAIN_GOT'));
game.deed = null;
game.neighbourDeeds = [{ name: deed, x: dx, y: dy, radius: 8, level: 1, holder: null }];
check('a stranger holds the key to the crate', got('STRANGER_TAKEALL').startsWith('false|'), got('STRANGER_TAKEALL'));
same('and is refused all the same', crateShut(game, crate()), got('STRANGER_TAKEALL').split('|')[1]);
check('told whose store it is', got('STRANGER_TAKEALL').split('|')[1] === storeStrangerSaid(crateWhat, deed), got('STRANGER_TAKEALL'));
same('one thing out of it', crateShut(game, crate()), got('STRANGER_TAKE'));
same('and the chest', pieceShut(game, chest()), got('STRANGER_CHEST'));
check('a put with no store named passes over a store shut to you, and not over one open to you',
  got('STRANGER_NEAREST') === 'true|true', got('STRANGER_NEAREST'));

console.log('--- the log');
check('the founder empties both', got('BOSS_TAKEALL') === 'ALLOWED' && got('EMPTIED') === '0|0', `${got('BOSS_TAKEALL')}; ${got('EMPTIED')}`);
const log = JSON.parse(got('LOG')) as StoreLogEntry[];
const lines = log.map(storeLogLine);
check('every take and every put is logged, newest first: who, what, how many, which way',
  log.length === 6
  && lines[5] === `${nPorter} took 2 × log out of the ${crateWhat}`
  && lines[4] === `${nPorter} put 3 × rock shards into the ${crateWhat}`
  && lines[3] === `${nPorter} put 4 × rock shards into the ${chestWhat}`
  && lines[2] === `${nBoss} took 3 × log out of the ${crateWhat}`
  && lines[1] === `${nBoss} took 3 × rock shards out of the ${crateWhat}`
  && lines[0] === `${nBoss} took 4 × rock shards out of the ${chestWhat}`
  && log.every((e) => e.at > 0), lines.join('; '));
check('and read by a rank holding Keep the stores and by the founder', log.length === 6 && got('LOG_BOSS') === '6', got('LOG_BOSS'));
check('not by a citizen without it', got('LOG_PLAIN') === lacksSaid(deed, 'Builder', 'keep_stores'), got('LOG_PLAIN'));
check('nor by a stranger', got('LOG_STRANGER') === `Not a citizen of ${deed}.`, got('LOG_STRANGER'));
const [n, newest, oldest, cap] = got('CAP').split('|').map(Number);
check(`it keeps the last ${STORE_LOG_CAP} and lets the rest go`, n === STORE_LOG_CAP && cap === STORE_LOG_CAP
  && newest === STORE_LOG_CAP + 7 && oldest === 8 && got('CAP_ROWS') === String(STORE_LOG_CAP), `${got('CAP')}; ${got('CAP_ROWS')}`);
check('and nobody reads the table but through the door', got('LOG_READ') === 'false', got('LOG_READ'));

console.log('--- moving it');
game.deed = home('Porter', powerBit('use_stores'));
same('a porter may not pick the crate up', storeMoveRefusal(game, crate(), crateWhat), got('PICK_PORTER'));
check('in the words kept for it', got('PICK_PORTER') === storeMoveSaid(crateWhat, deed), got('PICK_PORTER'));
check('whoever set it down (holding its key), and the founder, may: the crate is empty, so nothing else stops them',
  got('PICK_KEEPER') === 'ALLOWED' && got('PICK_BOSS') === 'ALLOWED', `${got('PICK_KEEPER')}; ${got('PICK_BOSS')}`);
same('nor lift the chest', storeMoveRefusal(game, chest(), chestWhat), got('LIFT_PORTER'));
same('nor turn it', storeMoveRefusal(game, chest(), chestWhat), got('TURN_PORTER'));
check('whoever set the chest down, and the founder, may', got('LIFT_KEEPER') === 'ALLOWED' && got('LIFT_BOSS') === 'ALLOWED',
  `${got('LIFT_KEEPER')}; ${got('LIFT_BOSS')}`);
game.deed = { ...home('Founder', 0), role: 'founder', rank: undefined, perms: undefined };
check('and the browser lets the founder', storeMoveRefusal(game, crate(), crateWhat) === null);

console.log('--- what else');
check('a craft and a build never draw on it, even for the founder', got('CRAFT') === '0|0', got('CRAFT'));
game.deed = home('Builder', builderPerms);
same('unmarked, one thing out of a padlocked crate asks the key of a builder, as emptying it does',
  crateShut(game, { ...crate(), storeOf: undefined, mine: true }), got('UNMARKED_TAKE'));
check('and the one holding the key takes it', got('UNMARKED_KEY') === 'ALLOWED', got('UNMARKED_KEY'));
check('disbanding unmarks its stores', got('DISBANDED') === 'NULL|NULL', got('DISBANDED'));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`settlement stores — ${ok.length} of ${ok.length}`);
