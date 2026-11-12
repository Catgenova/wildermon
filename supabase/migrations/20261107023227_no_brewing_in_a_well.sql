-- No brewing in a well.
--
-- Asked for: "Brewing should not be an option directly in wells." A brew is set going in a barrel, not in a well or a
-- fountain: water is drawn from the well into a barrel and brewed there, as the brewing worker always did. The
-- browser's `brewReason` and `brewBarrel`.

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

select pg_temp.patch_fn('public.brew_reason(uuid,uuid,placed,brew_def)'::regprocedure,
  $o$  if not holds_liquid(p) then return 'That holds no liquid.'; end if;
$o$,
  $n$  if not holds_liquid(p) then return 'That holds no liquid.'; end if;
  if is_well(p) then return 'Not a barrel.'; end if;
$n$);

select private.lock_doors();
