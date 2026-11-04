-- A rare thing put into a crate stays rare.
--
-- Reported: "Nakatari just placed a 4ql supreme plank into his settlement crate and it lost its rarity." `crate_put`
-- put a stackable thing in through `crate_add`, which knows only a def, a quality, `extra` and a casting's piece: it
-- folded the supreme plank into the crate's plain planks, or made a new row of a plain one, and the rarity, dye,
-- blessing, maker, charges, mark and enchantment were gone. `crate_add` also folded plain things from a worker into a
-- rare pile, making them all rare.
--
-- `crate_put` now goes onto a pile only of what it is in everything but the count (`stack_key`, the browser's
-- `sameStack`), and otherwise moves the row, or the part asked for as a row carrying all the row carries, as it did
-- for a thing that does not stack. `crate_add`, for the plain things workers and carts bring, goes only onto a plain
-- pile. The browser's `crateAdd` (`src/game/game.ts`) the same.
--
-- Nakatari's plank: taken back off the plain pile in the settlement crate the store log says it went into, the pile's
-- quality put back as it was, and a supreme plank of quality 4 given back to him.

set local lock_timeout = '3s';

create or replace function public.crate_add(p_world uuid, p_id integer, p_def text, p_count integer, p_ql double precision,
                                            p_extra text default null, p_cast text default null)
returns boolean
language plpgsql as $f$
declare c crate; stacks boolean; into_id bigint;
begin
  select * into c from crate where world_id = p_world and id = p_id;
  if not found then return false; end if;
  if crate_units(p_world, p_id) + p_count > crate_capacity(c) then return false; end if;
  select coalesce(d.stackable, false) into stacks from item_def d where d.id = p_def;
  if stacks then
    -- Onto a plain pile only: what comes in here carries nothing but its quality (`sameStack`).
    select i.id into into_id from item i
    where i.world_id = p_world and i.holder = 'crate' and i.crate = p_id and i.def = p_def
      and i.extra is not distinct from p_extra and i.piece is not distinct from p_cast
      and i.rare is null and i.dye is null and i.bless is null and i.maker is null and i.charges is null
      and i.mark is null and i.enchant is null and i.keyed is null
      and not coalesce(i.locked, false) and not coalesce(i.lit, false) and not coalesce(i.issued, false)
    limit 1;
    if into_id is not null then
      update item set ql = (ql * count + p_ql * p_count) / (count + p_count), count = count + p_count
        where id = into_id;
      return true;
    end if;
  end if;
  insert into item (world_id, holder, crate, gx, gy, def, ql, count, extra, piece)
  values (p_world, 'crate', p_id, c.x, c.y, p_def, greatest(0, least(100, p_ql)), p_count, p_extra, p_cast);
  return true;
end $f$;

create or replace function public.crate_put(p_world uuid, p_uid uuid, p_crate integer, p_item bigint, p_want integer,
                                            out put integer, out why text)
returns record
language plpgsql as $f$
declare v_c crate; v_it item; v_kept deed; v_want int; v_part item; v_key jsonb; v_onto bigint;
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
  -- The count asked for, as far as there is room (`cratePut`).
  put := least(v_want, crate_spare(p_world, v_c));
  if put <= 0 then
    put := 0;
    why := 'The ' || lower(crate_name(v_c)) || ' is full.';
    return;
  end if;
  -- Onto a pile in the crate that is this in everything but the count (`sameStack`): its rarity, dye, blessing,
  -- maker, charges, mark and enchantment the same.
  if coalesce((select stackable from item_def where id = v_it.def), false) then
    v_part := v_it;
    v_part.inside := null;
    v_key := stack_key(v_part);
    if v_key is not null then
      select i.id into v_onto from item i
       where i.world_id = p_world and i.holder = 'crate' and i.crate = v_c.id and i.def = v_it.def
         and stack_key(i) = v_key
       limit 1 for update;
    end if;
  end if;
  if v_onto is not null then
    update item set ql = (ql * count + v_it.ql * put) / (count + put), count = count + put where id = v_onto;
    if put >= v_it.count then delete from item where id = v_it.id;
    else update item set count = count - put where id = v_it.id; end if;
  elsif put < v_it.count then
    -- Part of the row: a row of its own in the crate, carrying all the row carries.
    v_part := v_it;
    v_part.id := nextval(pg_get_serial_sequence('item', 'id'));
    v_part.count := put;
    v_part.holder := 'crate'; v_part.holder_uid := null; v_part.crate := v_c.id;
    v_part.gx := v_c.x; v_part.gy := v_c.y; v_part.inside := null; v_part.placed := null;
    insert into item overriding system value select (v_part).*;
    update item set count = count - put where id = v_it.id;
  else
    update item set holder = 'crate', holder_uid = null, crate = v_c.id, gx = v_c.x, gy = v_c.y, inside = null, placed = null
      where id = v_it.id;
  end if;
  if v_kept.founded_by is not null then
    perform store_log_add(p_world, v_kept.founded_by, p_uid, true, v_it.def, lower(item_name(v_it)), put, crate_name(v_c));
  end if;
end $f$;

-- Nakatari's supreme plank, on the live island.
do $live$
declare w uuid; v_uid uuid; l deed_store_log; v_row item; v_given bigint;
begin
  select id into w from world where id::text like 'f3a88670%';
  if w is null then return; end if;
  select uid into v_uid from player where world_id = w and lower(name) = 'nakatari' limit 1;
  if v_uid is null then raise notice 'Nakatari: no such player'; return; end if;
  select * into l from deed_store_log
   where world_id = w and uid = v_uid and put and def = 'plank' and what like '%supreme%'
   order by id desc limit 1;
  if not found then raise notice 'Nakatari: no supreme plank in the store log'; return; end if;
  -- The plain pile it was folded into, in a crate of that settlement by the name the log gives.
  select i.* into v_row from item i join crate c on c.world_id = i.world_id and c.id = i.crate
   where i.world_id = w and i.holder = 'crate' and i.def = 'plank' and i.rare is null and i.count >= 1
     and crate_name(c) = l.store and (store_kept(w, c.store_of, c.x, c.y)).founded_by = l.founder
   order by abs(i.ql - 4) limit 1 for update of i;
  if found then
    if v_row.count <= 1 then delete from item where id = v_row.id;
    else update item set count = count - 1, ql = greatest(0, least(100, (ql * count - 4) / (count - 1))) where id = v_row.id;
    end if;
    raise notice 'Nakatari: one plank off pile % in "%" (% there)', v_row.id, l.store, v_row.count;
  else
    raise notice 'Nakatari: no plain plank pile left in "%"', l.store;
  end if;
  v_given := give(w, v_uid, 'plank', 1, 4, null, 'supreme');
  raise notice 'Nakatari: supreme plank given back, item %', v_given;
end $live$;

select private.lock_doors();
