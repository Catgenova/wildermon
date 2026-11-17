-- A load to a container named for it first, for every worker on its settlement; and the store a load goes to found
-- with the cheap checks first.
--
-- Asked for: fragments can be sorted into a box named "fragment", all of them. A box named for an item already took it
-- from a Hoardback (`private.hoard_into`), and no one else: a Snout bringing up a fragment carried it to the nearest
-- store with room, named or not. Now any worker on its settlement (no post, not following its keeper) puts a load in
-- the nearest container named for it with room first, then the bin built for it, then the settlement crate, then the
-- nearest store, as before. A Hoardback alone still never puts anything in a container named for something else.
--
-- Read off the island (2026-11-17, `private.slow_think`): a Snout's think of 1.1-1.3 s every minute or two, all 25 of the
-- slowest in six hours, and one of 36.7 s. Each find goes to a store (`worker_store`), and `worker_store_round` walked
-- every store on the settlement nearest first, asking of each whether a worker may use it, whether its storey is
-- reached (a way worked out up the stairs, `creature_way`) and only then whether it had room. With the near ones full
-- that was a way up the stairs for every store upstairs. Room is asked first now: the same store is found.

set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

select pg_temp.patch_fn('public.worker_store(uuid, creature, text, integer)'::regprocedure,
$o$  if private.hoard_trade(c) then
    return query select * from private.hoard_into(p_world, c, p_def, p_count);$o$,
$n$  if c.post is null and c.around is null then
    return query select * from private.hoard_into(p_world, c, p_def, p_count);$n$);

select pg_temp.patch_fn('private.worker_store_round(uuid, creature, text, integer, double precision, double precision, integer, double precision, boolean)'::regprocedure,
$o$    if r.s_kind = 'crate' then
      if not coalesce(private.worker_crate_ok(p_world, c.keeper, r.s_cr), false) then continue; end if;
      if (r.s_cr).level > 0 and not coalesce(storey_reached(p_world, (r.s_cr).x, (r.s_cr).y, (r.s_cr).level), false) then continue; end if;
      if not coalesce(crate_units(p_world, (r.s_cr).id) + p_count <= crate_capacity(r.s_cr), false) then continue; end if;
    else
      if not coalesce(furniture_holds(r.s_pl), false) or furniture_refuses(r.s_pl, p_def) is not null then continue; end if;
      if not coalesce(private.worker_piece_ok(p_world, c.keeper, r.s_pl), false) then continue; end if;
      if (r.s_pl).level > 0 and not coalesce(storey_reached(p_world, (r.s_pl).x, (r.s_pl).y, (r.s_pl).level), false) then continue; end if;
      if not coalesce(p_count <= furniture_room(r.s_pl, p_def), false) then continue; end if;
    end if;$o$,
$n$    -- Room first, then whether a worker may use it, and last whether its storey is reached (a way up the stairs).
    if r.s_kind = 'crate' then
      if not coalesce(crate_units(p_world, (r.s_cr).id) + p_count <= crate_capacity(r.s_cr), false) then continue; end if;
      if not coalesce(private.worker_crate_ok(p_world, c.keeper, r.s_cr), false) then continue; end if;
      if (r.s_cr).level > 0 and not coalesce(storey_reached(p_world, (r.s_cr).x, (r.s_cr).y, (r.s_cr).level), false) then continue; end if;
    else
      if not coalesce(furniture_holds(r.s_pl), false) or furniture_refuses(r.s_pl, p_def) is not null then continue; end if;
      if not coalesce(p_count <= furniture_room(r.s_pl, p_def), false) then continue; end if;
      if not coalesce(private.worker_piece_ok(p_world, c.keeper, r.s_pl), false) then continue; end if;
      if (r.s_pl).level > 0 and not coalesce(storey_reached(p_world, (r.s_pl).x, (r.s_pl).y, (r.s_pl).level), false) then continue; end if;
    end if;$n$);

select private.lock_doors();
