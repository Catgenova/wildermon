/*
 * A kept thing stays kept, wherever it is moved.
 *
 * Reported: "Something is unlocking my supreme mortars over and over." Nothing
 * on the island clears `locked` on a pile that stays loose in the pack: every
 * action was asked of a kept pile of supreme mortar and only `unlock_item`
 * unlocked it (`supabase/test/keptmoves.ts`). Where a lock was lost is where
 * the pile moved, and in one fold:
 *
 *   * `move_part`, the one move between the pack, a bag, furniture, a counter
 *     and a store, wrote the part it split off with `locked = false`: one of
 *     ten kept mortar put in a bag was a loose mortar there, and a loose one
 *     taken back. And a kept row moved whole merged into the first stack of
 *     its kind where it went, kept or not: a kept pile stowed beside a loose
 *     one, or taken back into a pack holding a loose one, was loose. Now the
 *     part is kept as the row was, a kept row joins only a kept pile, a loose
 *     one only a loose pile -- but in the pack, where a kept pile takes more of
 *     the same first, as `give` and `pack_fold_one` have it (`keptStack`);
 *   * `pack_fold` summed a pile again under its hold by the ids it had read,
 *     not by the pile: a pile kept between the read and the hold was folded
 *     into the loose one beside it. The rows summed are the pile's still.
 */
set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_new text; v_n int; i int;
  v_swap text[][];
begin
  -- ---------------------------------------------------------------- move_part
  v_def := pg_get_functiondef('public.move_part(bigint, integer, text, uuid, bigint, bigint)'::regprocedure);
  if position('-- Kept with kept' in v_def) = 0 then
    v_swap := array[
      [$o$      and o.piece is not distinct from it.piece
    order by o.id limit 1$o$,
       $n$      and o.piece is not distinct from it.piece
      -- Kept with kept and loose with loose, but in the pack, where a kept pile takes more of the same first (`keptStack`).
      and case when coalesce(it.locked, false) then coalesce(o.locked, false)
               else p_holder = 'player' or not coalesce(o.locked, false) end
    order by (p_holder = 'player' and coalesce(o.locked, false)) desc, o.id limit 1$n$],
      -- The part split off is kept as the row it came off.
      [$o$it.extra, it.rare, it.dye, it.bless, it.charges, false, it.maker, it.piece,$o$,
       $n$it.extra, it.rare, it.dye, it.bless, it.charges, coalesce(it.locked, false), it.maker, it.piece,$n$]];
    for i in 1 .. array_length(v_swap, 1) loop
      v_old := v_swap[i][1];
      v_new := v_swap[i][2];
      v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
      if v_n <> 1 then raise exception 'move_part has % of change %, not 1', v_n, i; end if;
      v_def := replace(v_def, v_old, v_new);
    end loop;
    execute v_def;
  end if;

  -- ---------------------------------------------------------------- pack_fold
  v_def := pg_get_functiondef('public.pack_fold(uuid, uuid)'::regprocedure);
  if position('stack_key(i) = r.k' in v_def) = 0 then
    v_swap := array[
      [$o$           min(i.rot_at) as rot_at
      from item i
     where i.world_id = p_world$o$,
       $n$           min(i.rot_at) as rot_at, stack_key(i) as k
      from item i
     where i.world_id = p_world$n$],
      -- Summed again under the hold as the pile it still is: a row kept since the read is not in it.
      [$o$      from item i where i.id = any(r.ids) and i.holder = 'player' and i.holder_uid = p_uid;$o$,
       $n$      from item i where i.id = any(r.ids) and i.holder = 'player' and i.holder_uid = p_uid
       and stack_key(i) = r.k;$n$]];
    for i in 1 .. array_length(v_swap, 1) loop
      v_old := v_swap[i][1];
      v_new := v_swap[i][2];
      v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
      if v_n <> 1 then raise exception 'pack_fold has % of change %, not 1', v_n, i; end if;
      v_def := replace(v_def, v_old, v_new);
    end loop;
    execute v_def;
  end if;
end $do$;

select private.lock_doors();
