-- A starting-kit tool put in a store or on the ground is still yours: coming ashore does not give it again.
--
-- Reported: "i appear to be getting infinite new sets of starter tools on login/refresh ... never more than one of
-- each at a time, but i can deposit one and refresh to get a new one". `kit_topup` gave any kit tool with no issued
-- copy held by the player (`holder_uid`); one put in a chest, a crate or on the ground is held by nobody, so each
-- coming ashore gave another. Now a kit tool counts as yours wherever it is: held by you, or issued to you
-- (`item.origin_uid`, which every copy of a row carries, `20261026130000_where_each_thing_came_from.sql`). One worn
-- out or burnt is gone, and is given again, as before. Starter tools are not traded (`barter_thing_refusal`,
-- `rpc_deal`, `rpc_price`, `order_fits`), so the only ones issued to you are your own.
--
-- `kit_topup` writes whose it is on each tool it gives, whatever door it was called from (`player_die` from the
-- clock has no caller); and the kit tools held now, given before every row carried its origin
-- (`20261031190000_a_kit_for_who_had_none.sql`), are marked as their holder's.

set local lock_timeout = '3s';

create or replace function kit_topup(p_world uuid, p_uid uuid) returns int
language plpgsql as $$
declare r record; v_n int := 0; v_id bigint;
begin
  for r in select * from (values
      ('hatchet', 20, 'Copper'), ('shovel', 20, 'Copper'), ('pickaxe', 20, 'Copper'),
      ('carving_knife', 20, 'Copper'), ('chisel', 20, 'Copper'), ('mallet', 20, 'Pine'),
      ('trowel', 20, 'Copper'), ('saw', 20, 'Copper'), ('butchering_knife', 20, 'Copper'),
      ('rake', 20, 'Copper'), ('sickle', 20, 'Copper'), ('hammer', 20, 'Copper'),
      ('file', 20, null), ('whetstone', 20, null), ('awl', 20, null), ('needle', 20, null),
      ('rope_tool', 20, null), ('brush', 20, null), ('fishing_rod', 20, null), ('fishing_net', 20, null),
      ('quern', 20, null), ('water_skin', 30, null)) v(def, ql, made)
  loop
    continue when exists (select 1 from item i where i.world_id = p_world and i.def = r.def and i.issued
                                                   and (i.holder_uid = p_uid or i.origin_uid = p_uid));
    insert into item (world_id, holder, holder_uid, def, ql, extra, issued, charges)
    values (p_world, 'player', p_uid, r.def, r.ql, r.made, true,
            (select charges from item_def where id = r.def))
    returning id into v_id;
    update item set origin_uid = p_uid where id = v_id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- The kit tools held now that do not say whose they are.
update item set origin_uid = holder_uid
 where issued and holder_uid is not null and origin_uid is null;

select private.lock_doors();
