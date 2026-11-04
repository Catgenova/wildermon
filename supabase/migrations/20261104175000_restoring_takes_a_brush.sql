-- Restoring takes a brush.
--
-- Asked: "Make investigating use a Trowel and Restoring use a brush." Investigate already wanted a trowel, its tool in
-- the definitions and "Need a trowel." here. Restore (`restore_relic`, a relic's pieces or a tarnished bauble) now
-- wants a brush in the pack, "Need a brush.", and wears it as any job wears its tool (`act_perform`, off the
-- definitions' `tool`). The browser's `restore_relic` (`src/game/archaeology.ts`, `RESTORE_TOOL_NEED`) says the same.

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

select pg_temp.patch_fn('public.dig_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  -- At any damage short of breaking: nothing mends a find before it is restored.
  if it.def = 'tarnished_bauble' then return null; end if;$o$,
  $n$  -- Restoring, a relic or a bauble: with a brush.
  if pack_count(p_world, p_uid, 'brush') < 1 then return 'Need a brush.'; end if;
  -- At any damage short of breaking: nothing mends a find before it is restored.
  if it.def = 'tarnished_bauble' then return null; end if;$n$);

select private.lock_doors();
