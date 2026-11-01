-- The starting kit without the frying pan and the clay bowl, pot and jar.
--
-- Asked: "Remove clay bowl, pot, jar, frying pan from starter tools." `kit_topup` (20261031180000) gives the rest of
-- the list as it was; the browser's `STARTER_KIT` is the same list, and `KIT_LEFT_OUT` names the four. Issued copies
-- already held stay where they are.

set local lock_timeout = '3s';

create or replace function kit_topup(p_world uuid, p_uid uuid) returns int
language plpgsql as $$
declare r record; v_n int := 0;
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
    continue when exists (select 1 from item i where i.world_id = p_world and i.holder_uid = p_uid
                                                   and i.def = r.def and i.issued);
    insert into item (world_id, holder, holder_uid, def, ql, extra, issued, charges)
    values (p_world, 'player', p_uid, r.def, r.ql, r.made, true,
            (select charges from item_def where id = r.def));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

select private.lock_doors();
