-- Work around me stores nothing on a settlement.
--
-- Asked for: "Enforce that a Work Around Me wildermon will not store into containers on a settlement". Storage in
-- reach of a worker round its keeper (`around_stores`) was any crate or storing piece within its range that the
-- keeper may fill (`private.worker_crate_ok`, `private.worker_piece_ok`), on a settlement or off. Now a crate or a
-- piece on any settlement's square (`deed_covers`) is out of reach, whosever it is; the cart or wagon the keeper
-- pulls or drives and the boat they are aboard stay in reach wherever they stand, as before. The browser's
-- `Game.aroundStores` by `deedAt`.
--
-- And the defs before this (learn_pace_def: the Cartling line's driving at three times the evened pace) do not lock
-- the doors; this does.

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

select pg_temp.patch_fn('public.around_stores(uuid,uuid,integer,integer,integer)'::regprocedure,
  $o$     and private.worker_crate_ok(p_world, p_uid, k.cr)$o$,
  $n$     and private.worker_crate_ok(p_world, p_uid, k.cr)
     -- And on no settlement.
     and not exists (select 1 from deed d where d.world_id = p_world and deed_covers(d, (k.cr).x, (k.cr).y))$n$);

select pg_temp.patch_fn('public.around_stores(uuid,uuid,integer,integer,integer)'::regprocedure,
  $o$          or private.worker_piece_ok(p_world, p_uid, b.p))$o$,
  $n$          or (private.worker_piece_ok(p_world, p_uid, b.p)
              -- And on no settlement.
              and not exists (select 1 from deed d where d.world_id = p_world and deed_covers(d, (b.p).x, (b.p).y))))$n$);

select private.lock_doors();
