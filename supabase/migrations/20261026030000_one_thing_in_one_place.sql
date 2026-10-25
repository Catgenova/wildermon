/**
 * One thing in one place, however many ask for it at once.
 *
 * Asked for: lock items during trades. Every function that moves a row between
 * holders, or splits or merges a stack, holds the rows it read before it writes
 * them, and a "there are at least n" followed by a subtraction is one statement
 * that refuses when there are not.
 *
 * Most doors already did: a crate's row and then the thing (`perform_crate`,
 * `crate_put`), a rack's row (`perform_rack_put`), both bodies and both sides
 * of a trade (`rpc_barter_accept`), the thing on the stall (`rpc_buy`), the
 * work and the settlement crate (`rpc_work_deliver`), the purse
 * (`take_coins`). `twice.ts` fires each of them from several connections at
 * the same row and counts every thing before and after. What it caught, and
 * what this holds:
 *
 *   * the stack a thing is folded into (`pack_fold_one`, `pack_fold`,
 *     `move_part`) was read bare and written back as the sum: a buy folding
 *     into the ore that was going into a crate at that moment wrote the ore
 *     back as if none had gone, and the five in the crate were in the pack as
 *     well. Both rows held, lower id first, and read again under the hold;
 *   * a drop read the stack bare and wrote it back as what it had read less
 *     what was dropped: a delivery out of the same stack in that moment came
 *     back. Held, and the count taken off what is there (`perform_hands`,
 *     `perform_cellar`);
 *   * a pick-up read the ground bare and moved the row by its id alone: two
 *     hands on one hatchet both said "Picked up" and the second took it out of
 *     the first one's pack. Held, and only off the ground; a sweep leaves
 *     what another sweep has in hand to it;
 *   * workers fetching out of the stores read a stack bare and deleted it by
 *     its id when they meant to take all of it: six at once carried thirty
 *     away from a crate of five (`take_some_stored`, `take_one_stored`,
 *     `take_from_stores`, `sort_take`, the butcher's and the feeder's and the
 *     sower's single one, `site_take`, `take_spoil`). Each takes what is still
 *     there, where it was seen, or nothing;
 *   * using things up (`consume`, `craft_consume`, timber steps) counted what
 *     there was bare and took it a row at a time: two at once could both count
 *     enough and the second take half, and an id deleted after the row had
 *     changed hands came out of somebody else's pack. What is to be used is
 *     held first and counted under the hold;
 *   * putting into furniture, a bag and the trash, and emptying a bag, read
 *     the thing bare before `move_part` held it by its id alone: held where it
 *     was seen (`perform_holding`).
 *
 * Locks are taken in id order where more than one row is held at once.
 */

/**
 * Take n of a row, if it is still where it was seen and has at least n: one
 * statement for the part and one for the whole, each asking again under the
 * row's lock. False when somebody else got there first.
 */
create or replace function item_take_units(p_it item, p_n int) returns boolean
language plpgsql as $fn$
begin
  if p_it.id is null or coalesce(p_n, 0) <= 0 then return false; end if;
  update item set count = count - p_n
   where id = p_it.id and holder = p_it.holder and holder_uid is not distinct from p_it.holder_uid
     and crate is not distinct from p_it.crate and placed is not distinct from p_it.placed
     and inside is not distinct from p_it.inside and count > p_n;
  if found then return true; end if;
  delete from item
   where id = p_it.id and holder = p_it.holder and holder_uid is not distinct from p_it.holder_uid
     and crate is not distinct from p_it.crate and placed is not distinct from p_it.placed
     and inside is not distinct from p_it.inside and count = p_n;
  return found;
end $fn$;

do $do$
declare r record; v_def text; v_n int; v_new int; i int; v_done boolean;
begin
  for r in select * from (values

    /* ---- folding into a stack ------------------------------------------------ */
    (1, 'pack_fold_one(bigint)', array[
$o$   order by o.locked desc, o.id limit 1;
  if not found then return p_id; end if;
$o$], array[
$n$   order by o.locked desc, o.id limit 1;
  if not found then return p_id; end if;
  -- Both rows held, lower id first, and both read again under the hold: what
  -- was read before it is not what is written back (`twice.ts`).
  perform 1 from item where id in (v_it.id, v_into.id) order by id for update;
  select * into v_it from item where id = p_id and holder = 'player' and holder_uid = v_it.holder_uid;
  if not found then return p_id; end if;
  select * into v_into from item o
   where o.id = v_into.id and o.world_id = v_it.world_id and o.holder = 'player' and o.holder_uid = v_it.holder_uid
     and o.def = v_it.def and (stack_key(o) = stack_key(v_it) or kept_key(o) = stack_key(v_it));
  if not found then return p_id; end if;
$n$]),

    (2, 'pack_fold(uuid,uuid)', array[
$o$declare r record; v_gone int := 0;
$o$,
$o$  loop
    update item set ql = least(100, greatest(0, r.ql))::real, dmg = greatest(0, r.dmg)::real,
                    count = r.units, rot_at = r.rot_at
      where id = r.keep;
    delete from item where id = any(r.ids) and id <> r.keep;
    v_gone := v_gone + array_length(r.ids, 1) - 1;
$o$], array[
$n$declare r record; v_gone int := 0; v_r record;
$n$,
$n$  loop
    -- The pile's rows held, in id order, and summed again under the hold.
    perform 1 from item where id = any(r.ids) order by id for update;
    select min(i.id) as keep, array_agg(i.id) as ids, sum(i.count)::int as units,
           sum(i.ql::numeric * i.count) / sum(i.count) as ql,
           sum(i.dmg::numeric * i.count) / sum(i.count) as dmg,
           min(i.rot_at) as rot_at
      into v_r
      from item i where i.id = any(r.ids) and i.holder = 'player' and i.holder_uid = p_uid;
    continue when coalesce(array_length(v_r.ids, 1), 0) < 2;
    update item set ql = least(100, greatest(0, v_r.ql))::real, dmg = greatest(0, v_r.dmg)::real,
                    count = v_r.units, rot_at = v_r.rot_at
      where id = v_r.keep;
    delete from item where id = any(v_r.ids) and id <> v_r.keep;
    v_gone := v_gone + array_length(v_r.ids, 1) - 1;
$n$]),

    (3, 'move_part(bigint,integer,text,uuid,bigint,bigint)', array[
$o$      and o.piece is not distinct from it.piece
    order by o.id limit 1;
$o$], array[
$n$      and o.piece is not distinct from it.piece
    order by o.id limit 1
    -- Held, and asked again under the hold, before its count is written back as the sum.
    for update;
$n$]),

    /* ---- the ground ---------------------------------------------------------- */
    (4, 'perform_hands(uuid,uuid,text,jsonb)', array[
$o$  elsif p_action = 'drop' then
    select * into it from item where world_id = p_world and id = target_item(p_target)
      and holder = 'player' and holder_uid = p_uid;
$o$,
$o$      update item set count = it.count - v_want where id = it.id;
$o$,
$o$      and (target_item(p_target) is null or id = target_item(p_target))
      order by id limit 1;
$o$,
$o$      order by (i.gx - v_x) ^ 2 + (i.gy - v_y) ^ 2, i.id
    loop
$o$], array[
$n$  elsif p_action = 'drop' then
    select * into it from item where world_id = p_world and id = target_item(p_target)
      and holder = 'player' and holder_uid = p_uid for update;
$n$,
$n$      update item set count = count - v_want where id = it.id;
$n$,
$n$      and (target_item(p_target) is null or id = target_item(p_target))
      order by id limit 1
      -- Held: two hands on one thing, and the second finds it gone.
      for update;
$n$,
$n$      order by (i.gx - v_x) ^ 2 + (i.gy - v_y) ^ 2, i.id
      -- Held as it is taken; what another sweep has in hand is left to it.
      for update of i skip locked
    loop
$n$]),

    (5, 'perform_cellar(uuid,uuid,text,jsonb)', array[
$o$  elsif p_action = 'drop' then
    -- Onto the cellar's floor, where things keep longest (`cellar_decay`): `perform_hands` has it up top.
    select * into it from item where world_id = p_world and id = target_item(p_target)
      and holder = 'player' and holder_uid = p_uid;
$o$,
$o$      update item set count = it.count - v_want where id = it.id;
$o$,
$o$      and gx = v_x and gy = v_y and (target_item(p_target) is null or id = target_item(p_target))
      order by id limit 1;
$o$,
$o$      order by (i.gx - v_x) ^ 2 + (i.gy - v_y) ^ 2, i.id
    loop
$o$], array[
$n$  elsif p_action = 'drop' then
    -- Onto the cellar's floor, where things keep longest (`cellar_decay`): `perform_hands` has it up top.
    select * into it from item where world_id = p_world and id = target_item(p_target)
      and holder = 'player' and holder_uid = p_uid for update;
$n$,
$n$      update item set count = count - v_want where id = it.id;
$n$,
$n$      and gx = v_x and gy = v_y and (target_item(p_target) is null or id = target_item(p_target))
      order by id limit 1 for update;
$n$,
$n$      order by (i.gx - v_x) ^ 2 + (i.gy - v_y) ^ 2, i.id
      -- Held as it is taken; what another sweep has in hand is left to it.
      for update of i skip locked
    loop
$n$]),

    /* ---- into furniture, a bag, the trash ------------------------------------ */
    (6, 'perform_holding(uuid,uuid,text,jsonb)', array[
$o$  select * into it from item where world_id = p_world and id = target_item(p_target)
    and holder = 'player' and holder_uid = p_uid;
$o$,
$o$    for v_bag in select * from item where inside = it.id and holder = 'bag' order by id loop
$o$], array[
$n$  select * into it from item where world_id = p_world and id = target_item(p_target)
    and holder = 'player' and holder_uid = p_uid for update;
$n$,
$n$    for v_bag in select * from item where inside = it.id and holder = 'bag' order by id for update loop
$n$]),

    /* ---- using things up ----------------------------------------------------- */
    (7, 'consume(uuid,uuid,text,integer,bigint,text)', array[
$o$begin
  only_mat := p_mat is not null and pack_count(p_world, p_uid, p_item, p_mat) >= p_n;
$o$], array[
$n$begin
  -- What could be used, held in id order, and counted under the hold.
  perform 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
     and i.def = p_item order by i.id for update;
  only_mat := p_mat is not null and pack_count(p_world, p_uid, p_item, p_mat) >= p_n;
$n$]),

    (8, 'craft_consume(uuid,uuid,text,integer,bigint,text)', array[
$o$begin
  only_mat := p_mat is not null and craft_count(p_world, p_uid, p_item, p_mat, p_prefer) >= p_n;
$o$], array[
$n$begin
  -- Everything within reach that could be used, held in id order, and counted under the hold.
  perform 1 from item i where i.id in (select s.id from craft_stock(p_world, p_uid, p_prefer) s where s.def = p_item)
   order by i.id for update;
  only_mat := p_mat is not null and craft_count(p_world, p_uid, p_item, p_mat, p_prefer) >= p_n;
$n$]),

    (9, 'perform_steps(uuid,uuid,text,jsonb)', array[
$o$       order by (i.id = v_it.id) desc, i.id
    loop
$o$], array[
$n$       order by (i.id = v_it.id) desc, i.id
       for update of i
    loop
$n$]),

    /* ---- out of the stores --------------------------------------------------- */
    (10, 'take_one_stored(uuid,uuid,text[],integer,integer)', array[
$o$  if v.count > 1 then update item set count = count - 1 where id = v.id;
  else delete from item where id = v.id; end if;
$o$], array[
$n$  if not item_take_units(v, 1) then return null; end if;
$n$]),

    (11, 'take_some_stored(uuid,uuid,text[],integer,integer,integer)', array[
$o$  k := least(p_n, v.count);
$o$], array[
$n$  -- Held where it was seen, and what is there now is what is taken.
  select * into v from item i where i.id = v.id and i.holder = v.holder
     and i.crate is not distinct from v.crate and i.placed is not distinct from v.placed for update;
  if not found then return null; end if;
  k := least(p_n, v.count);
$n$]),

    (12, 'take_from_stores(uuid,text)', array[
$o$  if v_it.count > 1 then
    update item set count = count - 1 where id = v_it.id;
  else
    delete from item where id = v_it.id;
  end if;
$o$], array[
$n$  if not item_take_units(v_it, 1) then return null; end if;
$n$]),

    (13, 'sort_take(uuid,creature,integer,integer)', array[
$o$  select * into v from item where id = s.iid for update;
$o$,
$o$  return jsonb_build_object('def', v.def, 'count', s.n,$o$], array[
$n$  select * into v from item where id = s.iid and holder in ('crate', 'furniture') for update;
$n$,
$n$  return jsonb_build_object('def', v.def, 'count', least(s.n, v.count),$n$]),

    (14, 'site_take(uuid,integer,integer,text)', array[
$o$  update item set count = count - 1 where id = v_id and count > 1;
  if found then return true; end if;
  delete from item where id = v_id;
$o$], array[
$n$  update item set count = count - 1 where id = v_id and holder = 'crate' and count > 1;
  if found then return true; end if;
  delete from item where id = v_id and holder = 'crate' and count = 1;
$n$]),

    (15, 'take_spoil(uuid,uuid,text)', array[
$o$  update item set count = count - 1 where id = v_id and count > 1;
  if found then return true; end if;
  delete from item where id = v_id;
$o$], array[
$n$  update item set count = count - 1 where id = v_id and holder in ('crate', 'furniture') and count > 1;
  if found then return true; end if;
  delete from item where id = v_id and holder in ('crate', 'furniture') and count = 1;
$n$]),

    (16, 'worker_feed(uuid,integer,double precision)', array[
$o$  if v_it.count > 1 then update item set count = count - 1 where id = v_it.id;
  else delete from item where id = v_it.id; end if;
$o$], array[
$n$  if not item_take_units(v_it, 1) then return null; end if;
$n$]),

    (17, 'worker_do(uuid,integer)', array[
$o$      if v_seed.count > 1 then
        update item set count = count - 1 where id = v_seed.id;
      else
        delete from item where id = v_seed.id;
      end if;
$o$], array[
$n$      if not item_take_units(v_seed, 1) then return null; end if;
$n$]),

    (18, 'errand_do(uuid,integer,boolean)', array[
$o$      if v_c.count > 1 then update item set count = count - 1 where id = v_c.id;
      else delete from item where id = v_c.id; end if;
$o$,
$o$        if v_it.count > 1 then update item set count = count - 1 where id = v_it.id;
        else delete from item where id = v_it.id; end if;
$o$], array[
$n$      if not item_take_units(v_c, 1) then return false; end if;
$n$,
$n$        if not item_take_units(v_it, 1) then return false; end if;
$n$])

  ) as t(ord, fn, olds, news) order by ord loop
    select pg_get_functiondef(r.fn::regprocedure) into v_def;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    v_done := true;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      v_new := (length(v_def) - length(replace(v_def, r.news[i], ''))) / length(r.news[i]);
      -- Run again over a database that has it already: nothing to do.
      if v_new = 1 then continue; end if;
      if v_n <> 1 then raise exception '% has % of %, not 1', r.fn, v_n, r.olds[i]; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
      v_done := false;
    end loop;
    if not v_done then execute v_def; end if;
  end loop;
end $do$;

select private.lock_doors();
