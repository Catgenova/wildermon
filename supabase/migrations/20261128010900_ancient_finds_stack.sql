/*
 * Ancient finds stack.
 *
 * Asked for: "items like ancient comb, ancient seed pot, ancient file should stack". A relic's restored thing --
 * the ancient comb, file, lamp, pot, collar, bridle, brace, whetstone, seed jar and stamp, the bronze mirror and the
 * rune tablet -- was not stackable (`item_def.stackable`, reloaded true by `_defs` just before this), so every one
 * restored, dug out of a cache or put in the pack was a row of its own. They go by the one rule now (`stack_key`):
 * one pile a kind, QL the average by the unit, as every pile is.
 *
 * The stamp is the one with something of its own on it: the goes it has left (`charges`, in `stack_key`). A pile of
 * fresh stamps pressed has one taken off it, its goes on that one alone (onto a pile with as many left, or one of its
 * own), and a started stamp is pressed before a fresh one is started. The browser's `pressStamp`.
 */

CREATE OR REPLACE FUNCTION public.press_stamp(p_world uuid, p_uid uuid, p_first double precision)
 RETURNS double precision
 LANGUAGE plpgsql
AS $function$
declare v_it item; v_left int; v_one item;
begin
  -- A started stamp before a fresh one (`stampCarried`).
  select * into v_it from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'ancient_stamp'
     and coalesce(i.charges, stamp_goes()::int) > 0
   order by coalesce(i.charges, stamp_goes()::int), i.id limit 1;
  if v_it.id is null then return p_first; end if;
  v_left := coalesce(v_it.charges, stamp_goes()::int) - 1;
  if v_left <= 0 then
    perform spend_stack(p_world, p_uid, v_it.id, 1);
    perform tell(p_world, p_uid, 'Ancient stamp: rare chance ×' || stamp_rare()::int || '. Last go; stamp used up.', 'event');
  else
    if v_it.count > 1 then
      -- One off the pile, the whole row copied so a column added later comes too, its goes on it alone.
      update item set count = count - 1 where id = v_it.id;
      v_one := v_it;
      v_one.id := nextval(pg_get_serial_sequence('public.item', 'id'));
      v_one.count := 1; v_one.charges := v_left;
      insert into item overriding system value values (v_one.*);
    else
      v_one := v_it;
      update item set charges = v_left where id = v_it.id;
    end if;
    -- Onto a pile with as many goes left, where there is one.
    perform pack_fold_one(v_one.id);
    perform tell(p_world, p_uid, 'Ancient stamp: rare chance ×' || stamp_rare()::int || '. ' || v_left || ' of '
      || stamp_goes()::int || ' goes left.', 'event');
  end if;
  return least(1, p_first * stamp_rare());
end $function$;

/*
 * And the ones already apart: every pack, bag, store, crate and pannier on every island, once, through the same
 * rule as `pack_fold` -- a pile of two and a pile of one become a pile of three at the average of the two. Nothing
 * carried changes by a gram; only the rows go down. A kept (locked) one, one priced on a stall or held in a deal is
 * left as it is.
 */
do $$
declare r record; v_gone int := 0; v_piles int := 0;
begin
  for r in
    select min(i.id) as keep, array_agg(i.id) as ids, sum(i.count)::int as units,
           sum(i.ql::numeric * i.count) / sum(i.count) as ql,
           sum(i.dmg::numeric * i.count) / sum(i.count) as dmg,
           min(i.rot_at) as rot_at
      from item i
     where i.def in ('bronze_mirror', 'ancient_comb', 'ancient_file', 'ancient_lamp', 'ancient_pot', 'ancient_collar',
                     'ancient_bridle', 'ancient_brace', 'ancient_whetstone', 'ancient_seed_jar', 'ancient_stamp',
                     'rune_tablet')
       and i.holder in ('player', 'bag', 'furniture', 'crate', 'pannier')
       and stack_key(i) is not null and i.price is null and i.deal is null and i.creature is null
     group by i.world_id, i.holder, i.holder_uid, i.placed, i.crate, i.pannier, stack_key(i)
    having count(i.id) > 1
  loop
    update item set ql = least(100, greatest(0, r.ql))::real, dmg = greatest(0, r.dmg)::real,
                    count = r.units, rot_at = r.rot_at
      where id = r.keep;
    delete from item where id = any(r.ids) and id <> r.keep;
    v_gone := v_gone + array_length(r.ids, 1) - 1;
    v_piles := v_piles + 1;
  end loop;
  raise notice 'ancient finds: % rows folded into % piles', v_gone, v_piles;
end $$;

select private.lock_doors();
