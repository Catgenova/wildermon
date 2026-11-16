/**
 * A trash crate destroys what is put in it, each stack whole, a time after it went in that the crate's QL sets.
 *
 * Asked for: "Trash bins should decay anything placed in them quickly. 3 hours at 1ql 30m at 100ql". On the island,
 * with the clock shifted back rather than waited on:
 *
 *   * the span is the browser's (`trashSpan`): 3 h at QL 1, 30 min at QL 100, linear between (QL 50);
 *   * in a QL 1 crate a stack is there at 2 h 59 min and gone past 3 h; in a QL 100 one there at 29 min and gone past
 *     30; in a QL 50 one there just short of its span and gone just past it;
 *   * Trash from the pack starts the clock; a stack put onto one already in goes with that one, whole;
 *   * taken out before its time, a stack is kept, the clock cleared; part of a stack taken out, the rest keeps its time;
 *   * a stack a Chestkit moves into a trash crate named for it is timed there and goes the same way;
 *   * the sweep is on the world clock (`world_tick`).
 *
 * Made on its own island, rolled back.
 */
import { TRASH_SECS_AT_1, TRASH_SECS_AT_100, trashSpan } from '../../src/game/trash';
import { ITEM_DEFS } from '../../src/game/items';
import { psql, check, finish } from './harness';

const T = 60;
const U = '7e5b0000-0000-4000-8000-000000000c21';
const S50 = trashSpan(50);

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
-- Shift every stack in this crate back so it has been in it p_secs seconds, sweep, and say how many of def are left.
create function pg_temp.aged(w uuid, p bigint, p_def text, p_secs double precision) returns int language plpgsql as $f$
begin
  update item set binned_at = now() - make_interval(secs => p_secs) where world_id = w and placed = p and def = p_def;
  perform trash_sweep(w);
  return (select coalesce(sum(count), 0)::int from item where world_id = w and placed = p and def = p_def);
end $f$;
create function pg_temp.settle(w uuid, m int, k int) returns void language plpgsql as $f$
declare i int;
begin
  for i in 1..k loop
    update creature set until = now() - interval '1 millisecond', leg_at = now() - interval '2 milliseconds',
           leg_ends = now() - interval '1 millisecond', hunger = 1
     where world_id = w and id = m;
    perform worker_settle(w, m);
  end loop;
end $f$;
do $t$
declare w uuid; u uuid := '${U}'; b1 bigint; b100 bigint; b50 bigint; named bigint; v_crate bigint; m int; v_it bigint; v_n int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Trashdecay', 261, 400, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 400);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 30}, ${T + 30}) x, generate_series(${T - 30}, ${T + 30}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Binner');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Binstead', ${T}, ${T}, 10, 5, u);
  update player set x = ${T} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now(), seen_at = now() where world_id = w;

  insert into said values ('SPAN', trash_span(1) || '|' || trash_span(100) || '|' || trash_span(50) || '|' || trash_span(0) || '|' || trash_span(120));

  -- Beside the player, QL 1; further off, QL 100 and QL 50.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'trash_crate', ${T} + 1, ${T}, 0, 0, ${T} + 1.125, ${T} + 0.125, 1, u) returning id into b1;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'trash_crate', ${T} + 8, ${T} + 8, 0, 0, ${T} + 8.125, ${T} + 8.125, 100, u) returning id into b100;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'trash_crate', ${T} + 8, ${T} - 8, 0, 0, ${T} + 8.125, ${T} - 7.875, 50, u) returning id into b50;

  -- Trash, from the pack.
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'plank', 30, 5) returning id into v_it;
  perform act_perform(w, u, 'throw_away', jsonb_build_object('kind', 'item', 'uid', v_it, 'count', 5));
  insert into said select 'THROWN', coalesce(sum(count), 0) || '|' || bool_and(binned_at > now() - interval '1 minute')
    from item where world_id = w and placed = b1 and def = 'plank';
  insert into said values ('QL1_259', pg_temp.aged(w, b1, 'plank', ${TRASH_SECS_AT_1} - 60));
  insert into said values ('QL1_301', pg_temp.aged(w, b1, 'plank', ${TRASH_SECS_AT_1} + 1));

  -- A stack put onto one already in: one stack, the time of the one that was in, gone together.
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', b1, 'log', 30, 3);
  update item set binned_at = now() - interval '2 hours' where world_id = w and placed = b1 and def = 'log';
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'log', 30, 2) returning id into v_it;
  perform act_perform(w, u, 'throw_away', jsonb_build_object('kind', 'item', 'uid', v_it, 'count', 2));
  insert into said select 'MERGED', count(*) || '|' || sum(count) || '|' || bool_and(binned_at < now() - interval '119 minutes')
    from item where world_id = w and placed = b1 and def = 'log';
  update item set binned_at = binned_at - interval '1 hour 1 second' where world_id = w and placed = b1 and def = 'log';
  perform trash_sweep(w);
  insert into said select 'MERGEGONE', coalesce(sum(count), 0) from item where world_id = w and placed = b1 and def = 'log';

  -- QL 100 and QL 50.
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', b100, 'stone', 30, 4), (w, 'furniture', b50, 'stone', 30, 4);
  insert into said values ('QL100_29', pg_temp.aged(w, b100, 'stone', ${TRASH_SECS_AT_100} - 60));
  insert into said values ('QL100_31', pg_temp.aged(w, b100, 'stone', ${TRASH_SECS_AT_100} + 1));
  insert into said values ('QL50_UNDER', pg_temp.aged(w, b50, 'stone', ${S50} - 5));
  insert into said values ('QL50_OVER', pg_temp.aged(w, b50, 'stone', ${S50} + 5));

  -- Taken out before its time: kept, and the clock cleared.
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'rope', 30, 1) returning id into v_it;
  perform act_perform(w, u, 'throw_away', jsonb_build_object('kind', 'item', 'uid', v_it, 'count', 1));
  update item set binned_at = now() - interval '2 hours' where world_id = w and placed = b1 and def = 'rope';
  perform act_perform(w, u, 'furniture_take_all', jsonb_build_object('kind', 'furniture', 'id', b1));
  update item set binned_at = now() - interval '5 hours' where world_id = w and holder = 'player' and def = 'rope' and binned_at is not null;
  perform trash_sweep(w);
  insert into said select 'TAKEN', coalesce(sum(count), 0) || '|' || coalesce(bool_and(binned_at is null), false)
    from item where world_id = w and holder = 'player' and holder_uid = u and def = 'rope';

  -- Part of a stack out: the rest keeps its time, the part out has none.
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', b1, 'clay', 30, 6) returning id into v_it;
  update item set binned_at = now() - interval '2 hours 30 minutes' where id = v_it;
  perform move_part(v_it, 2, 'player', u, null, null);
  insert into said select 'PART', (select count || '|' || (binned_at < now() - interval '149 minutes') from item where id = v_it)
    || '|' || (select coalesce(sum(count), 0) || '|' || bool_and(binned_at is null) from item where world_id = w and holder = 'player' and def = 'clay');
  update item set binned_at = binned_at - interval '31 minutes' where id = v_it;
  perform trash_sweep(w);
  insert into said select 'PARTGONE', (select count(*) from item where id = v_it) || '|'
    || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and def = 'clay');

  -- Out of a trash crate into a chest: no clock there.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${T} - 8, ${T} + 8, 0, 0, ${T} - 7.875, ${T} + 8.125, 30, u) returning id into v_crate;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', b1, 'hatchet', 30, 1) returning id into v_it;
  update item set placed = v_crate where id = v_it;
  insert into said select 'CHEST', coalesce((binned_at is null)::text, 'gone') from item where id = v_it;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_crate, 'hatchet', 30, 1) returning id into v_it;
  insert into said select 'CHESTIN', (binned_at is null)::text from item where id = v_it;

  -- A Chestkit: from a crate into the trash crate named for the item, timed there.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name)
    values (w, 'furniture', 'trash_crate', ${T} - 4, ${T} + 3, 0, 0, ${T} - 3.875, ${T} + 3.125, 1, u, 'Ancient Whetstone') returning id into named;
  v_crate := coalesce((select max(id) from crate), 0) + 1;
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by) values (w, v_crate, 'log', ${T}, ${T} + 3, 0, 0, u);
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', v_crate, 'ancient_whetstone', 30, 1);
  m := creature_spawn(w, 'magga', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, form_size = null, keeper = u, phase = 'idle', carrying = null, job = null, post = null, hunger = 1,
         from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5
   where world_id = w and id = m;
  perform pg_temp.settle(w, m, 120);
  insert into said select 'HOARD', coalesce(sum(count), 0) || '|' || coalesce(bool_and(binned_at > now() - interval '10 minutes'), false)
    from item where world_id = w and placed = named and def = 'ancient_whetstone';
  insert into said values ('HOARD_259', pg_temp.aged(w, named, 'ancient_whetstone', ${TRASH_SECS_AT_1} - 60));
  insert into said values ('HOARD_301', pg_temp.aged(w, named, 'ancient_whetstone', ${TRASH_SECS_AT_1} + 1));

  insert into said values ('TICK', (pg_get_functiondef('public.world_tick()'::regprocedure) like '%trash_sweep(w.id)%')::text);
  insert into said values ('DESC', (select description from item_def where id = 'trash_crate'));
end $t$;
select k || '=' || coalesce(v, '') from said;
rollback;
`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const said = (k: string): string => isle.get(k) ?? '(nothing)';

const [s1, s100, s50, s0, s120] = said('SPAN').split('|').map(Number);
check(`the span is the browser's: ${TRASH_SECS_AT_1} s at QL 1, ${TRASH_SECS_AT_100} s at QL 100, ${S50.toFixed(1)} s at QL 50, held to QL 1..100`,
  s1 === trashSpan(1) && s100 === trashSpan(100) && Math.abs(s50 - S50) < 1e-6 && s0 === s1 && s120 === s100
  && trashSpan(1) === 3 * 3600 && trashSpan(100) === 30 * 60, said('SPAN'));
check('Trash from the pack: in, timed from now', said('THROWN') === '5|true', said('THROWN'));
check('QL 1: there at 2 h 59 min', said('QL1_259') === '5', said('QL1_259'));
check('QL 1: gone past 3 h', said('QL1_301') === '0', said('QL1_301'));
check('a stack put onto one already in: one stack, the time of the one that was in', said('MERGED') === '1|5|true', said('MERGED'));
check('and gone together, whole, at that one\'s time', said('MERGEGONE') === '0', said('MERGEGONE'));
check('QL 100: there at 29 min', said('QL100_29') === '4', said('QL100_29'));
check('QL 100: gone past 30 min', said('QL100_31') === '0', said('QL100_31'));
check(`QL 50: there just short of ${S50.toFixed(0)} s`, said('QL50_UNDER') === '4', said('QL50_UNDER'));
check('QL 50: gone just past it', said('QL50_OVER') === '0', said('QL50_OVER'));
check('taken out before its time: kept, the clock cleared', said('TAKEN') === '1|true', said('TAKEN'));
check('part of a stack out: the rest keeps its time, the part out has none', said('PART') === '4|true|2|true', said('PART'));
check('and the rest goes at its time, the part out kept', said('PARTGONE') === '0|2', said('PARTGONE'));
check('moved on into a chest: no clock', said('CHEST') === 'true' && said('CHESTIN') === 'true', `${said('CHEST')} ${said('CHESTIN')}`);
check('a Chestkit\'s move into a trash crate named for it: timed there', said('HOARD') === '1|true', said('HOARD'));
check('and it goes at the crate\'s time', said('HOARD_259') === '1' && said('HOARD_301') === '0', `${said('HOARD_259')} ${said('HOARD_301')}`);
check('the sweep is on the world clock', said('TICK') === 'true', said('TICK'));
check('the island\'s description is the browser\'s', said('DESC') === ITEM_DEFS.trash_crate.description && said('DESC').startsWith('Destroys contents: 3 h at QL 1, 30 min at QL 100'),
  said('DESC'));

finish('a trash crate destroys what is put in it');
