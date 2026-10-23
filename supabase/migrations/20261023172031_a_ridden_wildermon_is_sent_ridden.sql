set local lock_timeout = '3s';

-- Reported: "Mounting a wildermon doesnt actually mount it". The island seats the rider (`creature.rider`, `perform_ride`)
-- and says "Mounted", but `rpc_creatures` never sent who is up, so the browser never read the body as mounted: it
-- walked at its own pace beside the mount. It is sent now, as whether the one asking rides it (`ridden`).
do $do$
declare v_def text; v_old text := '''mine'', coalesce(c.keeper = me, false),'; v_n int;
begin
  v_def := pg_get_functiondef('rpc_creatures'::regproc);
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_creatures has % of mine, not 1', v_n; end if;
  execute replace(v_def, v_old, v_old || ' ''ridden'', coalesce(c.rider = me, false),');
end $do$;

select private.lock_doors();
