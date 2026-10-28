-- A well's water is water, however far it was drawn down, in what the browser is sent.
--
-- Reported with a screenshot: a full well read "200 / 200 litres of empty", and the dough recipe beside it would still
-- not make. A well keeps its litres as at its last draw and the liquid column it had then, which is nothing once it is
-- drawn dry; the island counts it as water everywhere else (`placed_liquid`), and now sends that (`rpc_ground`), with
-- its litres as they stand (`placed_litres`). The browser counted only vessels holding water toward a recipe's litres.

set local lock_timeout = '3s';

do $do$
declare v text; v_n int;
  v_old text := $o$        || jsonb_build_object('fuel', placed_fuel(pl), 'ash', placed_ash(pl), 'litres', placed_litres(pl),
$o$;
  v_new text := $n$        || jsonb_build_object('fuel', placed_fuel(pl), 'ash', placed_ash(pl), 'litres', placed_litres(pl), 'liquid', placed_liquid(pl),
$n$;
begin
  select pg_get_functiondef('rpc_ground'::regproc) into v;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_ground has % of the line to change, not 1', v_n; end if;
  execute replace(v, v_old, v_new);
end $do$;

select private.lock_doors();
