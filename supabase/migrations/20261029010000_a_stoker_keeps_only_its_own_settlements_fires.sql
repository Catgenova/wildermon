-- A stoker keeps only its own settlement's fires lit.
--
-- Reported with a screenshot: "my slugferno is lighting campfires on other peoples deeds". A stoker fed the nearest
-- campfire, oven, brazier, smelter or kiln within its reach of its totem (`stoke_hearth`), whoever's ground it stood
-- on: its reach runs past its own settlement's edge onto the next one's. Now only one on its keeper's settlement
-- (`on_my_deed`), as a smelter worker's furnace already is (`furnace_target`).

set local lock_timeout = '3s';

do $do$
declare v text; v_n int;
  v_old text := $o$     and placed_fuel(p) < hearth_full()
$o$;
  v_new text := $n$     and placed_fuel(p) < hearth_full()
     and on_my_deed(p_world, c.keeper, p.x, p.y)
$n$;
begin
  select pg_get_functiondef('stoke_hearth'::regproc) into v;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'stoke_hearth has % of the line to change, not 1', v_n; end if;
  execute replace(v, v_old, v_new);
end $do$;

select private.lock_doors();
