-- Nakatari's supreme plank, given back.
--
-- Reported: "Nakatari just placed a 4ql supreme plank into his settlement crate and it lost its rarity." The crate is
-- fixed (20261104190000), but the plank was not given back there: that migration looked for the put in the store log,
-- and a settlement crate (`deed`, no `store_of`) is no store, so nothing was logged. The look found the pile it went
-- onto: settlement crate 59 at 1485, 3040 on Juno Wei Er, item 37557, 9 planks at quality 4.36, no rarity, the only
-- planks there.
--
-- One plank off that pile, its quality put back without the 4 that went in, and a supreme plank of quality 4 given to
-- Nakatari. Only on the live island, only while the pile is still that pile.

set local lock_timeout = '3s';

do $live$
declare w uuid; v_uid uuid; v_row item; v_given bigint;
begin
  select id into w from world where id::text like 'f3a88670%';
  if w is null then return; end if;
  select uid into v_uid from player where world_id = w and lower(name) = 'nakatari' limit 1;
  if v_uid is null then raise notice 'Nakatari: no such player'; return; end if;
  select * into v_row from item
   where id = 37557 and world_id = w and holder = 'crate' and crate = 59 and def = 'plank' and rare is null and count >= 1
   for update;
  if found then
    if v_row.count <= 1 then delete from item where id = v_row.id;
    else update item set count = count - 1, ql = greatest(0, least(100, (ql * count - 4) / (count - 1))) where id = v_row.id;
    end if;
    raise notice 'Nakatari: one plank off pile 37557 (% there)', v_row.count;
  else
    raise notice 'Nakatari: pile 37557 is not as it was; nothing taken off';
  end if;
  v_given := give(w, v_uid, 'plank', 1, 4, null, 'supreme');
  raise notice 'Nakatari: supreme plank given back, item %', v_given;
end $live$;
