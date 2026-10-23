set local lock_timeout = '3s';

-- Reported: a Thistlekit saddled and bridled, and Mount refused "no saddle and bridle". The island keeps it
-- (`creature.tacked`) and said so on Examine, but `rpc_creatures` sent the tack's marks and enchantments and never
-- whether it was on, so the browser's word stayed false and its menu refused the mount. It is sent now.
do $do$
declare v_def text; v_old text := '''tack'', c.tack, ''tack_enchant'', c.tack_enchant,'; v_n int;
begin
  v_def := pg_get_functiondef('rpc_creatures'::regproc);
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_creatures has % of the tack, not 1', v_n; end if;
  execute replace(v_def, v_old, '''tacked'', c.tacked, ' || v_old);
end $do$;

select private.lock_doors();
