/**
 * Ranks of your own.
 *
 * A settlement's ranks were a fixed ladder -- founder, mayor, builder, guest.
 * They are its founder's now: up to `RANK_CAP` besides the founder, named,
 * ordered and each given any of the powers in `RANK_POWERS`, with Mayor,
 * Builder and Guest to start with. This holds the two sides to each other:
 *
 *   * the list of powers, the cap, the longest name and what a rank's powers
 *     say after "you may" are the same on the island as in the browser;
 *   * every settlement, a new one included, starts with the three, doing
 *     what they did, and newcomers join as Builder;
 *   * making, renaming, moving and deleting a rank, each with its refusals,
 *     and only by the founder;
 *   * each power toggled off really stops its action on the island and on
 *     really allows it: shape (dig), stores (a crate), locks, invite, send
 *     away, set ranks, rename and upgrade -- and disbanding is the founder's
 *     whatever a rank holds;
 *   * a rank acts only on those below it;
 *   * every refusal the island gives is the browser's, word for word, read
 *     over the island's own `rpc_social` answer;
 *   * a settlement's ranks are read by its citizens and nobody else.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
// The game first: `deed.ts` and `actions.ts` import each other through it, and the game is what loads them in order.
import { Game, type Deed } from '../../src/game/game';
import { ACTION_BY_ID, disbandSaid, foreignGround, type Target } from '../../src/game/actions';
import { upgradeReason } from '../../src/game/deed';
import { crateNotYours, type PlacedCrate } from '../../src/game/crates';
import { lockRefusal } from '../../src/game/locks';
import {
  ALL_PERMS, DEFAULT_RANKS, lacks, lacksSaid, NEWCOMER_RANK, permsOf, POWER, powerBit, RANK_CAP, RANK_NAME_MAX, RANK_POWERS,
  rankAddRefusal, rankDropRefusal, rankMay, rankMoveRefusal, rankNameRefusal, type PowerId,
} from '../../src/game/ranks';
import type { MyDeed, Social } from '../../src/net/island';
import { asRanked, defOf, defsOf, inviteRefusal, joinedLine, rankedLine, rankRefusal, sendAwayRefusal } from '../../src/ui/panels/social';

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

/* ---- the list, on both sides ------------------------------------------------ */

console.log('--- the powers, the cap and the words');
const ids = RANK_POWERS.map((p) => p.id);
check('every power has its own id and its own bit, listed in the order of their bits',
  new Set(ids).size === ids.length && RANK_POWERS.every((p, i) => p.bit === i), ids.join(','));
const listed = psql(`select string_agg(id || '|' || bit || '|' || may || '|' || may_not || '|' || power_bit(id), E'\\n' order by bit) from rank_power;`);
const browser = RANK_POWERS.map((p) => `${p.id}|${p.bit}|${p.may}|${p.mayNot}|${powerBit(p.id)}`).join('\n');
check('the island lists the same powers, at the same bits, in the same words', listed === browser, listed === browser ? `${ids.length} powers` : `${listed}\n---\n${browser}`);
check('the island has no power the browser lacks', psql(`select power_bit('nothing')`) === '0');
check('the cap and the longest name are the same on both sides',
  psql('select rank_cap() || \'|\' || rank_name_max()') === `${RANK_CAP}|${RANK_NAME_MAX}`, psql('select rank_cap() || \'|\' || rank_name_max()'));
const mays = [0, ALL_PERMS, ...RANK_POWERS.map((p) => powerBit(p.id)), ...DEFAULT_RANKS.map((r) => permsOf(r.powers))];
const islandMay = psql(`select string_agg(rank_may(p), E'\\n' order by n) from unnest(array[${mays.join(',')}]) with ordinality u(p, n);`);
check('what a rank may do reads the same, for no power, every power, each alone and each starting rank',
  islandMay === mays.map(rankMay).join('\n'), islandMay.split('\n')[1]);
const seeds = psql(`select string_agg(name || '|' || ord || '|' || perms || '|' || newcomer, ',' order by ord)
  from deed_rank_def where founder = (select founded_by from deed order by founded_at limit 1)
   and world_id = (select world_id from deed order by founded_at limit 1);`);
check('a settlement standing before today was given the three, doing what they did',
  seeds === DEFAULT_RANKS.map((r, i) => `${r.name}|${i + 1}|${permsOf(r.powers)}|${r.name === NEWCOMER_RANK}`).join(','), seeds);
check('and so was every one', psql(`select count(*) from deed d where (select count(*) from deed_rank_def r
  where r.world_id = d.world_id and r.founder = d.founded_by) < 3`) === '0');

/* ---- the island ------------------------------------------------------------- */

const out = psql(`
begin;
create temp table said (k text);
do $$
declare w uuid; boss uuid; f uuid[]; may uuid; bld uuid; bld2 uuid; gst uuid; nu uuid; nu2 uuid; nu3 uuid; stranger uuid;
        dname text; dx int; dy int; r_mayor bigint; r_builder bigint; r_guest bigint; r_new bigint; r_keep bigint;
        v_crate int; v_lock bigint; i int; j jsonb; nd uuid;
begin
  select id into w from world where name = 'Hoarding';
  select founded_by, name, x, y into boss, dname, dx, dy from deed where world_id = w order by founded_at limit 1;
  select array_agg(q.uid order by q.uid) into f from (
    select p.uid from player p where p.world_id = w and p.uid <> boss
       and not exists (select 1 from deed d where d.world_id = w and d.founded_by = p.uid)
     order by p.uid limit 8) q;
  may := f[1]; bld := f[2]; bld2 := f[3]; gst := f[4]; nu := f[5]; nu2 := f[6]; nu3 := f[7]; stranger := f[8];
  delete from deed_member where world_id = w and uid = any(f);
  delete from deed_invite where world_id = w and uid = any(f);
  delete from deed_member where world_id = w and founder = boss;
  delete from deed_invite where world_id = w and founder = boss;
  delete from caller;
  -- A writer from before today names the rank in role; one that names none gets the newcomers' rank.
  insert into deed_member (world_id, founder, uid, role) values (w, boss, may, 'mayor'), (w, boss, gst, 'guest');
  insert into deed_member (world_id, founder, uid) values (w, boss, bld), (w, boss, bld2);
  select id into r_mayor from deed_rank_def where world_id = w and founder = boss and name = 'Mayor';
  select id into r_builder from deed_rank_def where world_id = w and founder = boss and name = 'Builder';
  select id into r_guest from deed_rank_def where world_id = w and founder = boss and name = 'Guest';
  insert into said values ('DEED|' || dname), ('BOSS|' || boss), ('MAY|' || may), ('BLD|' || bld), ('BLD2|' || bld2),
    ('GST|' || gst), ('NU|' || nu), ('NU2|' || nu2), ('NU3|' || nu3), ('STRANGER|' || stranger),
    ('X|' || dx), ('Y|' || dy),
    ('N_BOSS|' || folk_name(w, boss)), ('N_MAY|' || folk_name(w, may)), ('N_BLD|' || folk_name(w, bld)),
    ('N_BLD2|' || folk_name(w, bld2)), ('N_GST|' || folk_name(w, gst)), ('N_NU|' || folk_name(w, nu)),
    ('N_NU2|' || folk_name(w, nu2));
  insert into said select 'ROLL|' || string_agg(m.role || ':' || r.name, ',' order by array_position(array[may, bld, bld2, gst], m.uid))
    from deed_member m join deed_rank_def r on r.id = m.rank_id where m.world_id = w and m.founder = boss;

  -- A settlement founded now starts with the same three.
  nd := gen_random_uuid();
  insert into deed (world_id, name, x, y, radius, founded_by) values (w, 'Newstead', 2, 2, 1, nd);
  insert into said select 'NEWDEED|' || string_agg(name || '|' || ord || '|' || perms || '|' || newcomer, ',' order by ord)
    from deed_rank_def where world_id = w and founder = nd;
  delete from deed where world_id = w and founded_by = nd;
  insert into said select 'NEWDEED_GONE|' || count(*) from deed_rank_def where world_id = w and founder = nd;

  -- ---- the founder makes, renames, moves and deletes ranks
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  insert into said values ('S0|' || rpc_social(w)::text);
  insert into said values ('ADD_EMPTY|' || coalesce(rpc_rank_add(w, '  ')->>'why', 'ALLOWED'));
  insert into said values ('ADD_LONG|' || coalesce(rpc_rank_add(w, repeat('x', rank_name_max() + 1))->>'why', 'ALLOWED'));
  insert into said values ('ADD_FOUNDER|' || coalesce(rpc_rank_add(w, 'FOUNDER')->>'why', 'ALLOWED'));
  insert into said values ('ADD_DUP|' || coalesce(rpc_rank_add(w, 'guest')->>'why', 'ALLOWED'));
  insert into said values ('ADD|' || coalesce(rpc_rank_add(w, ' Warden ')->>'added', 'REFUSED'));
  select id into r_new from deed_rank_def where world_id = w and founder = boss and name = 'Warden';
  insert into said values ('ADD_ORD|' || (select ord || ':' || perms from deed_rank_def where id = r_new));
  for i in 5 .. rank_cap() loop
    perform rpc_rank_add(w, 'Rank ' || i);
  end loop;
  insert into said values ('S_FULL|' || rpc_social(w)::text);
  insert into said values ('ADD_CAP|' || coalesce(rpc_rank_add(w, 'One more')->>'why', 'ALLOWED'));
  insert into said values ('REN_DUP|' || coalesce(rpc_rank_rename(w, r_new, 'MAYOR')->>'why', 'ALLOWED'));
  insert into said values ('REN_GONE|' || coalesce(rpc_rank_rename(w, -5, 'Anything')->>'why', 'ALLOWED'));
  insert into said values ('REN_SELF_CASE|' || coalesce(rpc_rank_rename(w, r_new, 'WARDEN')->>'renamed', 'REFUSED'));
  insert into said values ('REN|' || coalesce(rpc_rank_rename(w, r_new, 'Keeper')->>'renamed', 'REFUSED'));
  r_keep := r_new;
  insert into said values ('MOVE_TOP|' || coalesce(rpc_rank_move(w, r_mayor, -1)->>'why', 'ALLOWED'));
  insert into said values ('MOVE_BOTTOM|' || coalesce(rpc_rank_move(w, (select id from deed_rank_def where world_id = w and founder = boss
    order by ord desc limit 1), 1)->>'why', 'ALLOWED'));
  insert into said values ('MOVE|' || coalesce(rpc_rank_move(w, r_keep, -1)->>'moved', 'REFUSED'));
  insert into said values ('MOVE_BACK|' || coalesce(rpc_rank_move(w, r_keep, 1)->>'moved', 'REFUSED'));
  insert into said values ('ORDER|' || (select string_agg(name, ',' order by ord) from deed_rank_def where world_id = w and founder = boss));
  insert into said values ('DROP_NEW|' || coalesce(rpc_rank_drop(w, r_builder)->>'why', 'ALLOWED'));
  insert into said values ('DROP_HELD|' || coalesce(rpc_rank_drop(w, r_guest)->>'why', 'ALLOWED'));
  insert into said values ('DROP|' || coalesce(rpc_rank_drop(w, (select id from deed_rank_def where world_id = w and founder = boss
    and name = 'Rank 8'))->>'dropped', 'REFUSED'));
  insert into said values ('DROP_GONE|' || coalesce(rpc_rank_drop(w, -5)->>'why', 'ALLOWED'));
  insert into said values ('ORDS|' || (select string_agg(ord::text, ',' order by ord) from deed_rank_def where world_id = w and founder = boss));
  insert into said values ('ALLOW_BAD|' || coalesce(rpc_rank_allow(w, r_keep, 'fly', true)->>'why', 'ALLOWED'));
  -- Nothing but the first three and Keeper from here on.
  delete from deed_rank_def where world_id = w and founder = boss and name like 'Rank %';
  insert into said values ('S1|' || rpc_social(w)::text);

  -- ---- nobody else changes them
  perform set_config('request.jwt.claims', json_build_object('sub', may)::text, true);
  insert into said values ('MAY_ADD|' || coalesce(rpc_rank_add(w, 'Mine')->>'why', 'ALLOWED'));
  insert into said values ('MAY_ALLOW|' || coalesce(rpc_rank_allow(w, r_builder, 'locks', true)->>'why', 'ALLOWED'));
  insert into said values ('MAY_PERMS|' || (select perms from deed_rank_def where id = r_builder));

  -- ---- shape: a builder digs, and not once the founder takes it away
  j := jsonb_build_object('kind', 'tile', 'x', dx, 'y', dy, 'cx', dx, 'cy', dy);
  insert into said values ('DIG_ON|' || coalesce(ground_deed_refusal(w, bld, 'dig', j), 'ALLOWED') || '|' || may_shape(w, bld, dx, dy));
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  perform rpc_rank_allow(w, r_builder, 'shape', false);
  insert into said values ('PERMS_NOSHAPE|' || (select perms from deed_rank_def where id = r_builder));
  insert into said values ('DIG_OFF|' || coalesce(ground_deed_refusal(w, bld, 'dig', j), 'ALLOWED') || '|' || may_shape(w, bld, dx, dy));
  insert into said values ('DIG_STRANGER|' || coalesce(ground_deed_refusal(w, stranger, 'dig', j), 'ALLOWED'));
  insert into said values ('DIG_FOUNDER|' || coalesce(ground_deed_refusal(w, boss, 'dig', j), 'ALLOWED'));
  perform rpc_rank_allow(w, r_builder, 'shape', true);
  insert into said values ('DIG_BACK|' || coalesce(ground_deed_refusal(w, bld, 'dig', j), 'ALLOWED') || '|' || may_shape(w, bld, dx, dy));

  -- ---- stores: the founder's crate on the settlement
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by) values (w, 9300, 'log', dx + 1, dy, 0, 0, boss);
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 9300, 'log', 30, 1);
  update player set body_at = now(), x = dx + 1.5, y = dy + 0.5 where world_id = w and uid in (bld, gst);
  j := jsonb_build_object('kind', 'crate', 'id', 9300);
  insert into said values ('CRATE_ON|' || crate_yours(w, bld, 9300) || '|' || coalesce(crate_refusal(w, bld, 'crate_take_all', j), 'ALLOWED'));
  insert into said values ('CRATE_GUEST|' || crate_yours(w, gst, 9300));
  perform rpc_rank_allow(w, r_builder, 'stores', false);
  insert into said values ('CRATE_OFF|' || crate_yours(w, bld, 9300) || '|' || coalesce(crate_refusal(w, bld, 'crate_take_all', j), 'ALLOWED'));
  insert into said values ('CRATE_INTO|' || coalesce(crate_refusal(w, bld, 'store_in_crate',
    jsonb_build_object('kind', 'item', 'into', 9300, 'item', (select id from item where world_id = w and holder = 'player' and holder_uid = bld limit 1))), 'ALLOWED'));
  insert into said values ('CRATE_STRANGER|' || coalesce(crate_refusal(w, stranger, 'crate_take_all', j), 'ALLOWED'));
  perform rpc_rank_allow(w, r_builder, 'stores', true);
  insert into said values ('CRATE_BACK|' || crate_yours(w, bld, 9300));

  -- ---- locks: the founder's master key, handed to a rank
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', boss, 'padlock', 40, 1) returning id into v_lock;
  update crate set lock = v_lock where world_id = w and id = 9300;
  insert into said values ('LOCK_FOUNDER|' || lock_shut(w, boss, v_lock, dx + 1, dy));
  insert into said values ('LOCK_OFF|' || lock_shut(w, bld, v_lock, dx + 1, dy) || '|' || coalesce(lock_refusal(w, bld, v_lock, dx + 1, dy), 'OPEN'));
  insert into said values ('LOCK_TAKE|' || coalesce(crate_refusal(w, bld, 'crate_take_all', j), 'ALLOWED'));
  insert into said values ('LOCK_STRANGER|' || coalesce(lock_refusal(w, stranger, v_lock, dx + 1, dy), 'OPEN'));
  perform rpc_rank_allow(w, r_builder, 'locks', true);
  insert into said values ('LOCK_ON|' || lock_shut(w, bld, v_lock, dx + 1, dy) || '|' || coalesce(crate_refusal(w, bld, 'crate_take_all', j), 'ALLOWED'));
  perform rpc_rank_allow(w, r_builder, 'locks', false);

  -- ---- rename and upgrade, on the settlement aimed at; disbanding, its founder's whatever
  j := jsonb_build_object('kind', 'tile', 'x', dx, 'y', dy, 'name', 'Renamed');
  insert into said values ('RENAME_OFF|' || coalesce(settlement_refusal(w, bld, 'rename_deed', j), 'ALLOWED'));
  insert into said values ('UPGRADE_OFF|' || coalesce(settlement_refusal(w, bld, 'upgrade_deed', j), 'ALLOWED'));
  insert into said values ('DISBAND_MAYOR|' || coalesce(settlement_refusal(w, may, 'disband_deed', j), 'ALLOWED'));
  perform rpc_rank_allow(w, r_builder, 'rename', true);
  perform rpc_rank_allow(w, r_builder, 'upgrade', true);
  perform rpc_rank_allow(w, r_mayor, 'upgrade', true);
  insert into said values ('RENAME_ON|' || coalesce(settlement_refusal(w, bld, 'rename_deed', j), 'ALLOWED'));
  insert into said values ('UPGRADE_ON|' || coalesce(settlement_refusal(w, bld, 'upgrade_deed', j), 'ALLOWED')
    || '|' || coalesce(upgrade_reason(w, boss), 'NONE'));
  perform perform_settlement(w, bld, 'rename_deed', j);
  insert into said values ('RENAMED|' || (select name from deed where world_id = w and founded_by = boss));
  insert into said values ('RENAMED_TOLD|' || (select text from event where world_id = w and uid = boss order by n desc limit 1));
  update deed set name = dname where world_id = w and founded_by = boss;
  insert into said values ('DISBAND_ALL|' || coalesce(settlement_refusal(w, bld, 'disband_deed', j), 'ALLOWED'));
  perform rpc_rank_allow(w, r_builder, 'rename', false);
  perform rpc_rank_allow(w, r_builder, 'upgrade', false);
  perform rpc_rank_allow(w, r_mayor, 'upgrade', false);

  -- ---- invite: a builder may not, until its rank may
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('S_BLD|' || rpc_social(w)::text);
  insert into said values ('INV_OFF|' || coalesce(rpc_invite(w, nu, boss)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  perform rpc_rank_allow(w, r_builder, 'invite', true);
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('S_BLD_INV|' || rpc_social(w)::text);
  insert into said values ('INV_ON|' || coalesce(rpc_invite(w, nu, boss)->>'asked', 'REFUSED'));
  -- And the newcomers' rank is the founder's to choose.
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  insert into said values ('NEWCOMERS|' || coalesce(rpc_rank_newcomers(w, r_guest)->>'newcomers', 'REFUSED'));
  insert into said values ('NEWCOMERS_GONE|' || coalesce(rpc_rank_newcomers(w, -5)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', nu)::text, true);
  insert into said values ('JOIN|' || coalesce(rpc_invite_answer(w, boss, true)->>'rank', 'REFUSED'));
  insert into said values ('JOIN_TOLD|' || (select text from event where world_id = w and uid = nu order by n desc limit 1));
  insert into said values ('JOIN_ROLE|' || deed_role(w, boss, nu));
  insert into said values ('G_NU|' || (rpc_ground(w)->'deed')::text);
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  perform rpc_rank_newcomers(w, r_builder);

  -- ---- send away: a rank may, and only below itself
  perform rpc_rank_allow(w, r_builder, 'send_away', false);
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('S_BLD_SEND|' || rpc_social(w)::text);
  insert into said values ('SEND_OFF|' || coalesce(rpc_leave_deed(w, boss, gst)->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  perform rpc_rank_allow(w, r_builder, 'send_away', true);
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('S_BLD_SEND2|' || rpc_social(w)::text);
  insert into said values ('SEND_UP|' || coalesce(rpc_leave_deed(w, boss, may)->>'why', 'ALLOWED'));
  insert into said values ('SEND_SAME|' || coalesce(rpc_leave_deed(w, boss, bld2)->>'why', 'ALLOWED'));
  insert into said values ('SEND_DOWN|' || coalesce(rpc_leave_deed(w, boss, nu)->>'left', 'REFUSED'));

  -- ---- set ranks: a rank may, below itself and to below itself
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  perform rpc_rank_allow(w, r_builder, 'set_ranks', false);
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('RANK_OFF|' || coalesce(rpc_rank(w, boss, gst, 'Keeper')->>'why', 'ALLOWED'));
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  perform rpc_rank_allow(w, r_builder, 'set_ranks', true);
  perform set_config('request.jwt.claims', json_build_object('sub', bld)::text, true);
  insert into said values ('S_BLD_RANK|' || rpc_social(w)::text);
  insert into said values ('RANK_UP|' || coalesce(rpc_rank(w, boss, may, 'Guest')->>'why', 'ALLOWED'));
  insert into said values ('RANK_SAME|' || coalesce(rpc_rank(w, boss, bld2, 'Guest')->>'why', 'ALLOWED'));
  insert into said values ('RANK_TO_MINE|' || coalesce(rpc_rank(w, boss, gst, 'builder')->>'why', 'ALLOWED'));
  insert into said values ('RANK_NONE|' || coalesce(rpc_rank(w, boss, gst, 'Nobody')->>'why', 'ALLOWED'));
  insert into said values ('RANK_ALREADY|' || coalesce(rpc_rank(w, boss, gst, 'guest')->>'why', 'ALLOWED'));
  insert into said values ('RANK_DOWN|' || coalesce(rpc_rank(w, boss, gst, 'keeper')->>'rank', 'REFUSED'));
  insert into said values ('RANK_TOLD|' || (select text from event where world_id = w and uid = gst order by n desc limit 1));
  insert into said values ('RANK_ROLE|' || deed_role(w, boss, gst));
  -- A rank whose name changes keeps everybody on it, under the new name.
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  perform rpc_rank_rename(w, r_keep, 'Steward');
  insert into said values ('RENAMED_ROLE|' || deed_role(w, boss, gst) || '|' || (select rank_id = r_keep from deed_member where world_id = w and founder = boss and uid = gst));
  insert into said values ('DROP_KEEP|' || coalesce(rpc_rank_drop(w, r_keep)->>'why', 'ALLOWED'));
end $$;
select string_agg(k, E'\\n') from said;
rollback;
`);
const got = (key: string): string => out.split('\n').find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? '(nothing)';
const answer = (key: string): Social => JSON.parse(got(key)) as Social;
const [deed, boss, may, bld, bld2, gst, nu, stranger] = ['DEED', 'BOSS', 'MAY', 'BLD', 'BLD2', 'GST', 'NU', 'STRANGER'].map(got);
const [nBoss, nMay, nBld2, nGst, nNu] = ['N_BOSS', 'N_MAY', 'N_BLD2', 'N_GST', 'N_NU'].map(got);
const [dx, dy] = [Number(got('X')), Number(got('Y'))];
const on = (s: Social): MyDeed => s.deeds.find((d) => d.founder === boss)!;
const same = (what: string, browser: string | null, island: string): void =>
  check(`${what}, in the same words on both sides`, browser === island && !['ALLOWED', 'REFUSED', '(nothing)'].includes(island),
    `${browser} / ${island}`);
const perm = (p: PowerId): number => powerBit(p);

console.log('--- the three, as they were');
check('a writer from before today lands on the rank it names, and one that names none on Builder, the newcomers\' rank',
  got('ROLL') === 'mayor:Mayor,builder:Builder,builder:Builder,guest:Guest', got('ROLL'));
check('a settlement founded today starts with the same three',
  got('NEWDEED') === DEFAULT_RANKS.map((r, i) => `${r.name}|${i + 1}|${permsOf(r.powers)}|${r.name === NEWCOMER_RANK}`).join(','), got('NEWDEED'));
check('and they go with it when it goes', got('NEWDEED_GONE') === '0', got('NEWDEED_GONE'));
const s0 = on(answer('S0'));
check('the island lists the founder its ranks, highest first, with how many hold each',
  defsOf(s0).map((r) => `${r.name}:${r.held}${r.newcomer ? '*' : ''}`).join(',') === 'Mayor:1,Builder:2*,Guest:1',
  defsOf(s0).map((r) => `${r.name}:${r.held}${r.newcomer ? '*' : ''}`).join(','));

console.log('--- making, renaming, moving and deleting');
same('a rank needs a name', rankAddRefusal(deed, defsOf(s0), '  '), got('ADD_EMPTY'));
same(`a name of more than ${RANK_NAME_MAX} characters`, rankAddRefusal(deed, defsOf(s0), 'x'.repeat(RANK_NAME_MAX + 1)), got('ADD_LONG'));
same('nobody is a rank called founder', rankAddRefusal(deed, defsOf(s0), 'FOUNDER'), got('ADD_FOUNDER'));
same('two ranks of one settlement are not called the same, whatever the case', rankAddRefusal(deed, defsOf(s0), 'guest'), got('ADD_DUP'));
check('a new rank is made, its name trimmed', got('ADD') === 'Warden', got('ADD'));
check('at the foot of the list, allowed nothing', got('ADD_ORD') === '4:0', got('ADD_ORD'));
const sFull = on(answer('S_FULL'));
check(`and up to ${RANK_CAP} of them`, defsOf(sFull).length === RANK_CAP, String(defsOf(sFull).length));
same(`but not a ${RANK_CAP + 1}th`, rankAddRefusal(deed, defsOf(sFull), 'One more'), got('ADD_CAP'));
const warden = defsOf(sFull).find((r) => r.name === 'Warden')!;
same('a rank is not renamed to another\'s name', rankNameRefusal(deed, defsOf(sFull), 'MAYOR', warden.id), got('REN_DUP'));
check('renaming a rank that is gone is refused', got('REN_GONE') === 'That rank is gone.', got('REN_GONE'));
check('a rank may be renamed to its own name in another case, and then renamed', got('REN_SELF_CASE') === 'WARDEN' && got('REN') === 'Keeper',
  `${got('REN_SELF_CASE')}, ${got('REN')}`);
same('the highest rank goes no higher', rankMoveRefusal(defsOf(sFull), defsOf(sFull)[0].id, -1), got('MOVE_TOP'));
same('the lowest no lower', rankMoveRefusal(defsOf(sFull), defsOf(sFull)[RANK_CAP - 1].id, 1), got('MOVE_BOTTOM'));
check('a rank moves a place up and back down, trading places with its neighbour',
  got('MOVE') === 'Keeper' && got('MOVE_BACK') === 'Keeper'
  && got('ORDER') === ['Mayor', 'Builder', 'Guest', 'Keeper', ...Array.from({ length: RANK_CAP - 4 }, (_, i) => `Rank ${i + 5}`)].join(','), got('ORDER'));
same('the newcomers\' rank is not deleted', rankDropRefusal(defsOf(sFull), defsOf(sFull).find((r) => r.name === 'Builder')!.id), got('DROP_NEW'));
same('nor a rank somebody holds', rankDropRefusal(defsOf(sFull), defsOf(sFull).find((r) => r.name === 'Guest')!.id), got('DROP_HELD'));
check('one nobody holds is, and the list closes up behind it',
  got('DROP') === `Rank ${RANK_CAP}` && got('ORDS') === Array.from({ length: RANK_CAP - 1 }, (_, i) => i + 1).join(','), `${got('DROP')}; ${got('ORDS')}`);
check('a rank that is gone, or a permission that is not one, is refused',
  got('DROP_GONE') === 'That rank is gone.' && got('ALLOW_BAD') === 'There is no such permission.', `${got('DROP_GONE')}; ${got('ALLOW_BAD')}`);
check('only the founder changes them', got('MAY_ADD') === 'You have founded no settlement to set ranks on.'
  && got('MAY_ALLOW') === got('MAY_ADD') && got('MAY_PERMS') === String(permsOf(DEFAULT_RANKS[1].powers)), `${got('MAY_ADD')}; ${got('MAY_PERMS')}`);
const s1 = on(answer('S1'));
const keeper = defsOf(s1).find((r) => r.name === 'Keeper')!;

console.log('--- shape');
const game = Game.create(4242);
const home = (perms: number): Deed => ({ name: deed, x: dx, y: dy, radius: 5, level: 1, mine: true, role: 'builder', rank: 'Builder', perms });
const builderPerms = permsOf(DEFAULT_RANKS[1].powers);
const dig = ACTION_BY_ID.get('dig')!;
const digAt: Target = { kind: 'tile', x: dx, y: dy, cx: dx, cy: dy } as Target;
check('a builder digs the settlement', got('DIG_ON') === 'ALLOWED|true', got('DIG_ON'));
check('taking Shape and build from the rank takes away exactly that bit', got('PERMS_NOSHAPE') === String(builderPerms & ~perm('shape')), got('PERMS_NOSHAPE'));
game.deed = home(builderPerms & ~perm('shape'));
game.neighbourDeeds = [];
check('and then the island refuses the dig', got('DIG_OFF').endsWith('|false'), got('DIG_OFF'));
same('naming the rank and what it lacks', foreignGround(game, dig, digAt), got('DIG_OFF').split('|')[0]);
check('which is the sentence every power refused says', got('DIG_OFF').split('|')[0] === lacksSaid(deed, 'Builder', 'shape'), got('DIG_OFF'));
check('a stranger is told whose ground it is, and the founder is never refused',
  got('DIG_STRANGER') === `Part of ${deed}: citizens only.` && got('DIG_FOUNDER') === 'ALLOWED',
  `${got('DIG_STRANGER')}; ${got('DIG_FOUNDER')}`);
game.deed = null;
game.neighbourDeeds = [{ name: deed, x: dx, y: dy, radius: 5, level: 1, holder: nBoss }];
same('a stranger, on both sides', foreignGround(game, dig, digAt), got('DIG_STRANGER'));
game.deed = home(builderPerms);
game.neighbourDeeds = [];
check('given back, the dig is allowed again on both sides', got('DIG_BACK') === 'ALLOWED|true' && foreignGround(game, dig, digAt) === null, got('DIG_BACK'));

console.log('--- stores');
check('a builder may use the founder\'s crate on the settlement, and so may a guest, as before',
  got('CRATE_ON') === 'true|ALLOWED' && got('CRATE_GUEST') === 'true', `${got('CRATE_ON')}; ${got('CRATE_GUEST')}`);
const crate = { id: 9300, x: dx + 1, y: dy, sx: 0, sy: 0, kind: 'log', items: [], mine: false, deed: false, material: null, name: null } as unknown as PlacedCrate;
game.deed = home(builderPerms & ~perm('stores'));
check('without Crates and stores it is not theirs', got('CRATE_OFF').startsWith('false|'), got('CRATE_OFF'));
same('and taking from it is refused by rank', crateNotYours(game, crate), got('CRATE_OFF').split('|')[1]);
same('and putting into it', crateNotYours(game, crate, ' to put anything in'), got('CRATE_INTO'));
game.deed = null;
same('a stranger is told it is not theirs', crateNotYours(game, crate), got('CRATE_STRANGER'));
check('given back, it is', got('CRATE_BACK') === 'true', got('CRATE_BACK'));

console.log('--- locks');
game.deed = home(builderPerms);
const padlocked = { lock: 1, x: dx + 1, y: dy };
check('the founder holds the master key', got('LOCK_FOUNDER') === 'false', got('LOCK_FOUNDER'));
check('a builder does not', got('LOCK_OFF').startsWith('true|'), got('LOCK_OFF'));
same('and is told by rank', lockRefusal([], padlocked, false, lacks(game.deed, 'locks')), got('LOCK_OFF').split('|')[1]);
same('taking from a locked crate says the same', game.lockRefusal(padlocked), got('LOCK_TAKE'));
same('a stranger has no key', lockRefusal([], padlocked, false, null), got('LOCK_STRANGER'));
check('given Open its locks, the builder opens it', got('LOCK_ON') === 'false|ALLOWED', got('LOCK_ON'));
game.deed = home(builderPerms | perm('locks'));
check('and so does the browser', game.lockRefusal(padlocked) === null);

console.log('--- rename, upgrade and disband');
game.deed = home(builderPerms);
const rename = ACTION_BY_ID.get('rename_deed')!;
const token = { kind: 'tile', x: dx, y: dy, cx: dx, cy: dy } as Target;
same('a builder may not rename it', rename.check?.(token, game) ?? null, got('RENAME_OFF'));
same('nor upgrade it', upgradeReason(game, game.deed), got('UPGRADE_OFF'));
same('nobody but the founder disbands it, a mayor included', disbandSaid(deed), got('DISBAND_MAYOR'));
check('given Rename, a builder may rename it, and the founder hears who did', got('RENAME_ON') === 'ALLOWED' && got('RENAMED') === 'Renamed'
  && got('RENAMED_TOLD').includes(`renames ${deed} to Renamed.`), `${got('RENAME_ON')}; ${got('RENAMED')}; ${got('RENAMED_TOLD')}`);
check('given Upgrade, a builder is refused only what the founder would be',
  got('UPGRADE_ON').split('|')[0] === (got('UPGRADE_ON').split('|')[1] === 'NONE' ? 'ALLOWED' : got('UPGRADE_ON').split('|')[1]), got('UPGRADE_ON'));
check('and disbanding stays the founder\'s, whatever a rank holds', got('DISBAND_ALL') === disbandSaid(deed), got('DISBAND_ALL'));

console.log('--- invite');
const sBld = answer('S_BLD');
same('a builder may not invite', inviteRefusal(sBld, nu, nNu, boss), got('INV_OFF'));
const sBldInv = answer('S_BLD_INV');
check('given Invite, the island tells the builder so and the browser offers it', inviteRefusal(sBldInv, nu, nNu, boss) === null
  && (on(sBldInv).perms ?? 0) === (builderPerms | perm('invite')), String(inviteRefusal(sBldInv, nu, nNu, boss)));
check('and the builder invites', got('INV_ON') === nNu, got('INV_ON'));
check('the founder chooses the newcomers\' rank, and one that is gone is refused',
  got('NEWCOMERS') === 'Guest' && got('NEWCOMERS_GONE') === 'That rank is gone.', `${got('NEWCOMERS')}; ${got('NEWCOMERS_GONE')}`);
const guestPerms = permsOf(DEFAULT_RANKS[2].powers);
check('the one asked joins at it, and is told what it may do in the browser\'s words',
  got('JOIN') === 'Guest' && got('JOIN_TOLD') === joinedLine(deed, 'Guest', guestPerms) && got('JOIN_ROLE') === 'guest',
  `${got('JOIN')}; ${got('JOIN_TOLD')}`);
const ground = JSON.parse(got('G_NU')) as { role?: string; rank?: string; perms?: number };
check('and the island tells their browser the rank and what it may do', ground.role === 'guest' && ground.rank === 'Guest' && ground.perms === guestPerms,
  got('G_NU'));

console.log('--- send away');
const sSend = answer('S_BLD_SEND');
same('without Send away, a builder sends nobody away', sendAwayRefusal(on(sSend), bld, gst), got('SEND_OFF'));
const sSend2 = on(answer('S_BLD_SEND2'));
same('with it, not somebody ranked above', sendAwayRefusal(sSend2, bld, may), got('SEND_UP'));
same('nor somebody ranked the same', sendAwayRefusal(sSend2, bld, bld2), got('SEND_SAME'));
check('but somebody ranked below, and the browser offers it', got('SEND_DOWN') === deed && sendAwayRefusal(sSend2, bld, nu) === null,
  `${got('SEND_DOWN')}; ${sendAwayRefusal(sSend2, bld, nu)}`);

console.log('--- set ranks');
same('without Set ranks, a builder sets nobody\'s rank', lacksSaid(deed, 'Builder', 'set_ranks'), got('RANK_OFF'));
const sRank = on(answer('S_BLD_RANK'));
same('with it, not somebody ranked above', rankRefusal(sRank, bld, may, nMay, 'Guest'), got('RANK_UP'));
same('nor somebody ranked the same', rankRefusal(sRank, bld, bld2, nBld2, 'Guest'), got('RANK_SAME'));
same('nor to their own rank', rankRefusal(sRank, bld, gst, nGst, 'builder'), got('RANK_TO_MINE'));
same('nor to a rank there is not', rankRefusal(sRank, bld, gst, nGst, 'Nobody'), got('RANK_NONE'));
same('nor to the rank they hold', rankRefusal(sRank, bld, gst, nGst, 'guest'), got('RANK_ALREADY'));
check('but to a rank below their own, for somebody below', got('RANK_DOWN') === 'Keeper' && rankRefusal(sRank, bld, gst, nGst, 'keeper') === null,
  `${got('RANK_DOWN')}; ${rankRefusal(sRank, bld, gst, nGst, 'keeper')}`);
check('the one ranked is told what the rank may do, in the browser\'s words',
  got('RANK_TOLD') === rankedLine(got('N_BLD'), 'Keeper', deed, keeper.perms) && got('RANK_ROLE') === 'keeper', got('RANK_TOLD'));
check('a rank renamed keeps everybody on it, under its new name', got('RENAMED_ROLE') === 'steward|true', got('RENAMED_ROLE'));
check('and one somebody holds is not deleted', got('DROP_KEEP') === `Steward held by 1 citizen: give them another rank first.`, got('DROP_KEEP'));
check('the browser knows which rank everybody holds, by id', defOf(sRank, gst)?.name === 'Guest' && defOf(sRank, may)?.name === 'Mayor'
  && asRanked(sRank).rank === 'Builder', JSON.stringify(sRank.held));

/* ---- who reads a settlement's ranks ----------------------------------------- */

console.log('--- who reads them');
const read = (uid: string): string => psql(`
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '${uid}')::text, true) \\g /dev/null
select count(*) from deed_rank_def where founder = '${boss}';
rollback;`).split('\n').filter((l) => /^\d+$/.test(l)).pop() ?? 'none';
// The roll the suite left, with one citizen on it for this.
psql(`insert into deed_member (world_id, founder, uid) select world_id, founded_by, '${may}' from deed
  where founded_by = '${boss}' and not exists (select 1 from deed_member where uid = '${may}' and founder = '${boss}');`);
check('its founder reads its ranks', read(boss) === '3', read(boss));
check('and so does a citizen', read(may) === '3', read(may));
check('and a stranger reads none of them', read(stranger) === '0', read(stranger));
check('and nobody writes them but the doors', psql(`select has_table_privilege('authenticated', 'deed_rank_def', 'insert')
  or has_table_privilege('authenticated', 'deed_rank_def', 'update') or has_table_privilege('anon', 'deed_rank_def', 'select')`) === 'f');
psql(`delete from deed_member where uid = '${may}' and founder = '${boss}';`);
void POWER;

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`ranks of your own — ${ok.length} of ${ok.length}`);
