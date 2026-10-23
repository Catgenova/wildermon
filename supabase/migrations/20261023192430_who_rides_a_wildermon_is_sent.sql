set local lock_timeout = '3s';

-- Reported: "Other players dont see me mounted, just zipping around with a wildermon in tow". `rpc_creatures` said
-- only whether the one asking rides each wildermon (`ridden`), so everybody else drew the rider on foot and the mount
-- going its own way on the wildlife's slower beat, behind them. It sends who rides it now (`rider`, their uid), which
-- the browser draws on its saddle and moves it with.
do $do$
declare v_def text; v_old text := '''ridden'', coalesce(c.rider = me, false),'; v_n int;
begin
  v_def := pg_get_functiondef('rpc_creatures'::regproc);
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_creatures has % of ridden, not 1', v_n; end if;
  execute replace(v_def, v_old, v_old || ' ''rider'', c.rider,');
end $do$;

select private.lock_doors();
