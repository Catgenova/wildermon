/*
 * A kept pile takes more of the same, and stays kept.
 *
 * Reported: five supreme mortar kept back, five more made, and the pack did
 * not read ten kept. A locked thing stacked with nothing (`stack_key` is null
 * for it), so whatever came in started or joined a loose pile beside it.
 *
 * Now what comes into a pack -- made, gathered, given (`give`) or moved in
 * (`pack_fold_one`) -- goes onto a kept pile it matches in everything but the
 * keeping (`kept_key`), before a loose one. A kept pile is still never folded
 * into a loose one, and two piles already standing are left as they are
 * (`pack_fold`). The browser puts things on a pile by the same rule
 * (`keptStack`).
 */
set local lock_timeout = '3s';

/* The pile a kept thing would be in were it not kept (`keptStack`); null for one that is not kept, or is lit. */
create or replace function kept_key(i item) returns jsonb
language plpgsql immutable as $$
declare v item := i;
begin
  if not coalesce(i.locked, false) then return null; end if;
  v.locked := false;
  return stack_key(v);
end $$;

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  v_def := pg_get_functiondef('public.give(uuid, uuid, text, integer, double precision, text, text, text, text, jsonb)'::regprocedure);
  v_old := $$       and i.def = p_item and stack_key(i) = stack_key(fresh)
     order by i.id limit 1;$$;
  v_new := $$       and i.def = p_item and (stack_key(i) = stack_key(fresh) or kept_key(i) = stack_key(fresh))
     -- A kept pile first (`keptStack`): what joins it is kept with it.
     order by i.locked desc, i.id limit 1;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'give has % of the pile it looks for, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('pack_fold_one'::regproc);
  v_old := $$     and o.id <> v_it.id and o.def = v_it.def and stack_key(o) = stack_key(v_it)
   order by o.id limit 1;$$;
  v_new := $$     and o.id <> v_it.id and o.def = v_it.def
     and (stack_key(o) = stack_key(v_it) or kept_key(o) = stack_key(v_it))
   -- A kept pile first (`keptStack`): what joins it is kept with it.
   order by o.locked desc, o.id limit 1;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'pack_fold_one has % of the pile it looks for, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
