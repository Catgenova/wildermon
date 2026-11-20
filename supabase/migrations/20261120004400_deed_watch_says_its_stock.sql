-- A settlement's watch says its stock: every store on it summed by item (`deed_store_stock`), for the Workers tab's
-- Stock and the meals its workers' upkeep has in store.
--
-- Asked for: a settlement stock total across all crates; upkeep shown as days left.

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

select pg_temp.patch_fn('public.rpc_deed_watch(uuid,uuid)'::regprocedure,
  $o$      'guards', (select count(*)::int from private.deed_workers(p_world, v_d.founded_by) w$o$,
  $n$      'stock', coalesce((select jsonb_object_agg(s.def, s.n)
                           from (select k.def, sum(k.n)::int as n from deed_store_stock(p_world, v_d.founded_by) k
                                  group by k.def) s), '{}'::jsonb),
      'guards', (select count(*)::int from private.deed_workers(p_world, v_d.founded_by) w$n$);

select private.lock_doors();
