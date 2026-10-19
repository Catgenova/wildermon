-- A stack let go over a crate rack goes into the crates standing on it, one after another.
--
-- Asked for: "Allow dragging inventory to a Crate shelf, where the crates on it will fill one by one according to
-- available space." A rack holds nothing of its own -- it is the ground eight crates stand on -- so a drop on it had
-- nowhere to go, and the way to fill one was to open each crate in turn and drag into it, counting what was left over
-- by hand.
--
-- `rack_put` is one ask that does the whole fill in one go: the first crate in the rack's order (`rack_crates`, front
-- to back and left to right, which is the browser's `rackDeck` and the order the model draws them) takes as much as
-- it has room for, then the next, until the stack is gone or every crate is full. What none of them has room for stays
-- in the pack, and one line says how much went where (`rack_put_line`).
--
-- Each crate is put into by the very rule a put of its own goes by. So the two halves of `store_in_crate` that are
-- about the crate rather than about finding it come out into functions of their own -- `crate_put_shut`, whether it
-- is shut to you (a settlement store by its rule, anything else by whose it is and its padlock), and `crate_put`, which
-- moves as much of a stack as it has room for under the crate's row lock and logs it to the store's settlement --
-- and both `store_in_crate` and `rack_put` go through them. A crate on the rack that is shut to you is passed over and
-- the rest are filled; the ask is refused only when every one is shut or full. The browser's `cratePutShut`,
-- `cratePut` and `rackPutLine`, in the same order and the same words.

set local lock_timeout = '3s';

-- The crates standing on a rack, in the order its spots fill: by row and then across, on the rack's own storey, and
-- over the block it covers the way it is turned (`furnitureFootprint`: width and depth swap when it stands across).
create or replace function rack_crates(p_world uuid, p placed) returns setof crate language sql stable as $fn$
  select c.* from crate c join furniture_def d on d.id = p.sub
   where c.world_id = p_world and d.crates is not null
     and c.x = p.x and c.y = p.y and floor_of(c.level) = floor_of(p.level)
     and c.sx >= p.sx and c.sx < p.sx + case when p.facing in ('e', 'w') then d.h else d.w end
     and c.sy >= p.sy and c.sy < p.sy + case when p.facing in ('e', 'w') then d.w else d.h end
   order by c.sy, c.sx
$fn$;

-- The rack a load is aimed at: the piece `into` names, when it is one whose deck takes crates.
create or replace function rack_into(p_world uuid, p_target jsonb) returns placed language sql stable as $fn$
  select p.* from placed p join furniture_def d on d.id = p.sub
   where p.world_id = p_world and p.kind = 'furniture' and d.crates is not null
     and p.id = nullif(p_target->>'into', '')::bigint
$fn$;

-- Why a crate will not have anything put into it by you, or null: a settlement store by its own rule (Use the
-- stores), in place of whose it is and its padlock; anything else by those two. How much room it has is asked after.
-- The browser's `cratePutShut`.
create or replace function crate_put_shut(p_world uuid, p_uid uuid, c crate) returns text language plpgsql stable as $fn$
declare v_kept deed;
begin
  v_kept := store_kept(p_world, c.store_of, c.x, c.y);
  if v_kept.founded_by is not null then
    return store_refusal(p_world, p_uid, v_kept, lower(crate_name(c)));
  end if;
  -- Putting your things into somebody else's crate is a way of losing them.
  if not crate_yours(p_world, p_uid, c.id) then
    return coalesce(rank_lacks_at(p_world, p_uid, c.x, c.y, 'stores'),
                    'The ' || lower(crate_name(c)) || ' is not yours to put anything in.');
  end if;
  if lock_shut(p_world, p_uid, c.lock, c.x, c.y) then
    return lock_refusal(p_world, p_uid, c.lock, c.x, c.y);
  end if;
  return null;
end $fn$;

/*
 * Put up to `p_want` of a stack in your pack into one crate, as far as it has room: `put` is how many went in, and
 * `why` what to say when none did and there is something to say.
 *
 * The crate's row first, so that two puts into one crate are measured against its room one after the other; under
 * that lock a settlement store's rule is asked again, for a go that started before somebody's rank changed. A thing
 * that stacks merges into the crate's own stack of it, as much as there is room for; anything else is the same row
 * moved into the crate, whole or not at all, so a bag keeps what is in it.
 */
create or replace function crate_put(p_world uuid, p_uid uuid, p_crate int, p_item bigint, p_want int,
                                     out put int, out why text)
language plpgsql as $fn$
declare v_c crate; v_it item; v_kept deed; v_want int;
begin
  put := 0;
  select * into v_c from crate where world_id = p_world and id = p_crate for update;
  if not found then return; end if;
  v_kept := store_kept(p_world, v_c.store_of, v_c.x, v_c.y);
  if v_kept.founded_by is not null then
    why := store_refusal(p_world, p_uid, v_kept, lower(crate_name(v_c)));
    if why is not null then return; end if;
  end if;
  select * into v_it from item where id = p_item
    and world_id = p_world and holder = 'player' and holder_uid = p_uid for update;
  if not found then return; end if;
  v_want := greatest(1, least(v_it.count, p_want));
  if coalesce((select stackable from item_def where id = v_it.def), false) then
    put := least(v_want, crate_spare(p_world, v_c));
    if put <= 0 or not crate_add(p_world, v_c.id, v_it.def, put, v_it.ql, v_it.extra, v_it.piece) then
      put := 0;
      why := 'The ' || lower(crate_name(v_c)) || ' is full.';
      return;
    end if;
    if put >= v_it.count then delete from item where id = v_it.id;
    else update item set count = count - put where id = v_it.id; end if;
  else
    if crate_units(p_world, v_c.id) + v_it.count > crate_capacity(v_c) then
      why := 'The ' || lower(crate_name(v_c)) || ' is full.';
      return;
    end if;
    update item set holder = 'crate', holder_uid = null, crate = v_c.id, gx = v_c.x, gy = v_c.y, inside = null, placed = null
      where id = v_it.id;
    put := v_it.count;
  end if;
  if v_kept.founded_by is not null then
    perform store_log_add(p_world, v_kept.founded_by, p_uid, true, v_it.def, lower(item_name(v_it)), put, crate_name(v_c));
  end if;
end $fn$;

-- What a load of a rack said: how many of how many, into how many crates on it -- the crate by name when it was only
-- one -- and how many did not fit. The browser's `rackPutLine`, word for word.
create or replace function rack_put_line(p_put int, p_want int, p_what text, p_crates int, p_one text, p_rack text)
returns text language sql immutable as $fn$
  select 'You put '
    || case when p_put = p_want then case when p_put > 1 then p_put || ' × ' else 'the ' end
            else p_put || ' of ' || p_want || ' × ' end
    || lower(p_what) || ' into '
    || case when p_crates = 1 then 'the ' || lower(p_one) else p_crates || ' crates' end
    || ' on the ' || lower(p_rack) || '.'
    || case when p_want > p_put then ' The other ' || (p_want - p_put) || ' would not fit.' else '' end
$fn$;

-- Loading a rack: the first crate on it with room takes what it has room for, then the next, all in this one go.
create or replace function perform_rack_put(p_world uuid, p_uid uuid, p_target jsonb) returns void
language plpgsql as $fn$
declare v_rack placed; v_it item; v_c crate; v_got record; v_want int; v_put int := 0; v_n int := 0; v_one text;
begin
  v_rack := rack_into(p_world, p_target);
  if v_rack.id is null then return; end if;
  -- The rack's row, so that two loads of one rack go one after the other rather than racing for the same room.
  perform 1 from placed where id = v_rack.id for update;
  select * into v_it from item where id = target_item(p_target)
    and world_id = p_world and holder = 'player' and holder_uid = p_uid;
  if not found then return; end if;
  v_want := greatest(1, least(v_it.count, coalesce((p_target->>'count')::int, 1)));
  for v_c in select * from rack_crates(p_world, v_rack) loop
    exit when v_put >= v_want;
    -- A crate shut to you is passed over, and the next one asked.
    if crate_put_shut(p_world, p_uid, v_c) is not null then continue; end if;
    v_got := crate_put(p_world, p_uid, v_c.id, v_it.id, v_want - v_put);
    if v_got.put > 0 then
      v_put := v_put + v_got.put;
      v_n := v_n + 1;
      if v_n = 1 then v_one := crate_name(v_c); end if;
    end if;
  end loop;
  if v_put = 0 then
    perform tell(p_world, p_uid, 'Every crate on the ' || lower(placed_name(v_rack)) || ' is full.', 'error');
    return;
  end if;
  perform tell(p_world, p_uid,
    rack_put_line(v_put, v_want, made_name(v_it.def, v_it.piece), v_n, v_one, placed_name(v_rack)), 'event');
end $fn$;

-- One of the crate family, so it is ported, answered for by `crate_refusal` and done by `perform_crate`.
create or replace function crate_action(p_action text) returns boolean language sql immutable as $fn$
  select p_action in ('place_crate', 'pick_up_crate', 'crate_take_all', 'store_in_crate',
                      'take_from_store', 'rack_put')
$fn$;

-- And the patches: `store_in_crate` through the two functions above, `rack_put` beside it, a load of a rack done where
-- the rack is (`target_spot`, for the storey), and carrying things into crates on a rack is no more exercise than
-- carrying them into one crate (`teaches_nothing`).
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'crate_refusal', array[
      $$    if v_c.id is null then return 'Stand next to a crate.'; end if;
    v_kept := store_kept(p_world, v_c.store_of, v_c.x, v_c.y);
    if v_kept.founded_by is not null then
      -- A settlement store: Use the stores, in place of whose it is and its padlock.
      v_why := store_refusal(p_world, p_uid, v_kept, lower(crate_name(v_c)));
      if v_why is not null then return v_why; end if;
    else
      -- Putting your things into somebody else's crate is a way of losing them.
      if not crate_yours(p_world, p_uid, v_c.id) then
        return coalesce(rank_lacks_at(p_world, p_uid, v_c.x, v_c.y, 'stores'),
                        'The ' || lower(crate_name(v_c)) || ' is not yours to put anything in.');
      end if;
      if lock_shut(p_world, p_uid, v_c.lock, v_c.x, v_c.y) then
        return lock_refusal(p_world, p_uid, v_c.lock, v_c.x, v_c.y);
      end if;
    end if;
$$,
      $$  elsif p_action = 'take_from_store' then
$$], array[
      $$    if v_c.id is null then return 'Stand next to a crate.'; end if;
    -- A settlement store by its rule, anything else by whose it is and its padlock (`crate_put_shut`).
    v_why := crate_put_shut(p_world, p_uid, v_c);
    if v_why is not null then return v_why; end if;
$$,
      $$  elsif p_action = 'rack_put' then
    /*
     * Loading a rack: refused only when no crate on it will take any of it. Every crate on it is asked what a put
     * of its own would be asked (`crate_put_shut` and its room), and the first that would take some is enough --
     * what the others do with the rest is the go's business. Measured from the rack's middle, as any piece is
     * reached, with the same slack a put into furniture has (`named_store`).
     */
    select * into v_it from item where id = target_item(p_target)
      and world_id = p_world and holder = 'player' and holder_uid = p_uid;
    if not found then return 'It is gone.'; end if;
    if crate_kind_of_item(v_it.def) is not null then return 'A crate does not go in a crate.'; end if;
    v_pl := rack_into(p_world, p_target);
    if v_pl.id is null then return 'It is gone.'; end if;
    if not near_piece(p_world, p_uid, v_pl, 2.6) then
      return 'Stand next to the ' || lower(placed_name(v_pl)) || '.';
    end if;
    v_want := greatest(1, least(v_it.count, coalesce((p_target->>'count')::int, 1)));
    -- How many crates are on it, and how many of them are open to you but full.
    v_tx := 0; v_sx := 0;
    for v_c in select * from rack_crates(p_world, v_pl) loop
      v_tx := v_tx + 1;
      if crate_put_shut(p_world, p_uid, v_c) is not null then
        v_why := coalesce(v_why, crate_put_shut(p_world, p_uid, v_c));
      elsif crate_spare(p_world, v_c)
            >= (case when coalesce((select stackable from item_def where id = v_it.def), false) then 1 else v_want end) then
        return null;
      else
        v_sx := v_sx + 1;
      end if;
    end loop;
    if v_tx = 0 then return 'There are no crates on the ' || lower(placed_name(v_pl)) || '.'; end if;
    -- Every one of them shut or full: full when none was shut, what shut the first when all were, and both when it
    -- was some of each.
    if v_why is null then return 'Every crate on the ' || lower(placed_name(v_pl)) || ' is full.'; end if;
    return v_why || case when v_sx > 0 then ' The others are full.' else '' end;

  elsif p_action = 'take_from_store' then
$$], array[1, 1]),
    (2, 'perform_crate', array[
      $$    if v_c.id is null then return; end if;
    -- The crate's row, so two puts into one crate are measured against its room one after the other.
    select * into v_c from crate where world_id = p_world and id = v_c.id for update;
    if not found then return; end if;
    v_kept := store_kept(p_world, v_c.store_of, v_c.x, v_c.y);
    if v_kept.founded_by is not null and store_refusal(p_world, p_uid, v_kept, lower(crate_name(v_c))) is not null then
      perform tell(p_world, p_uid, store_refusal(p_world, p_uid, v_kept, lower(crate_name(v_c))), 'error');
      return;
    end if;
    select * into v_it from item where id = target_item(p_target)
      and world_id = p_world and holder = 'player' and holder_uid = p_uid for update;
    if not found then return; end if;
    v_want := greatest(1, least(v_it.count, coalesce((p_target->>'count')::int, 1)));
    if coalesce((select stackable from item_def where id = v_it.def), false) then
      -- Stackables merge into the crate's own stack of them, a part at a time,
      -- and as far as there is room: what is over stays in the pack.
      v_fit := least(v_want, crate_spare(p_world, v_c));
      if v_fit <= 0 or not crate_add(p_world, v_c.id, v_it.def, v_fit, v_it.ql, v_it.extra, v_it.piece) then
        perform tell(p_world, p_uid, 'The ' || lower(crate_name(v_c)) || ' is full.', 'error');
        return;
      end if;
      if v_fit >= v_it.count then delete from item where id = v_it.id;
      else update item set count = count - v_fit where id = v_it.id; end if;
    else
      -- Anything else is the same row moved into the crate, so a bag keeps
      -- what is in it: the contents belong to the bag, wherever the bag is.
      -- The row used to be copied and the original deleted, and the deletion
      -- took the bag's contents with it.
      if crate_units(p_world, v_c.id) + v_it.count > crate_capacity(v_c) then
        perform tell(p_world, p_uid, 'The ' || lower(crate_name(v_c)) || ' is full.', 'error');
        return;
      end if;
      update item set holder = 'crate', holder_uid = null, crate = v_c.id, gx = v_c.x, gy = v_c.y, inside = null, placed = null
        where id = v_it.id;
      v_fit := v_it.count;
    end if;
    perform tell(p_world, p_uid,
      stored_line(v_fit, made_name(v_it.def, v_it.piece), crate_name(v_c), v_want - v_fit), 'event');
    if v_kept.founded_by is not null then
      perform store_log_add(p_world, v_kept.founded_by, p_uid, true, v_it.def, lower(item_name(v_it)), v_fit, crate_name(v_c));
    end if;
$$,
      $$  elsif p_action = 'take_from_store' then
$$], array[
      $$    if v_c.id is null then return; end if;
    select * into v_it from item where id = target_item(p_target)
      and world_id = p_world and holder = 'player' and holder_uid = p_uid;
    if not found then return; end if;
    v_want := greatest(1, least(v_it.count, coalesce((p_target->>'count')::int, 1)));
    -- As far as there is room, under the crate's row lock and its store's rule (`crate_put`): what is over stays in
    -- the pack. Loading a rack moves things by the same function, crate after crate.
    select (g).put, (g).why into v_fit, v_store from (select crate_put(p_world, p_uid, v_c.id, v_it.id, v_want) as g) q;
    if v_store is not null then
      perform tell(p_world, p_uid, v_store, 'error');
      return;
    end if;
    if v_fit <= 0 then return; end if;
    perform tell(p_world, p_uid,
      stored_line(v_fit, made_name(v_it.def, v_it.piece), crate_name(v_c), v_want - v_fit), 'event');

  elsif p_action = 'rack_put' then
    perform perform_rack_put(p_world, p_uid, p_target);
$$,
      $$  elsif p_action = 'take_from_store' then
$$], array[1, 1]),
    (3, 'target_spot', array[
      $$        elsif p_action = 'store_in_furniture' then$$], array[
      $$        -- A crate rack is loaded where it stands (`rack_put`), and so are the crates on it.
        elsif p_action in ('store_in_furniture', 'rack_put') then$$], array[1]),
    (4, 'teaches_nothing', array[
      $$'store_in_crate', 'store_in_furniture',$$], array[
      $$'store_in_crate', 'store_in_furniture', 'rack_put',$$], array[1])
  ) as t(ord, fn, olds, news, ns) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      if v_n <> r.ns[i] then raise exception '% has % of %, not %', r.fn, v_n, r.olds[i], r.ns[i]; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
    end loop;
    execute v_def;
  end loop;
end $do$;

select private.lock_doors();
