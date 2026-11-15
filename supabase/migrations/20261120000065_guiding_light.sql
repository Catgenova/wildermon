/*
 * The Path renamed the Guiding Light (`src/game/path.ts`): what the island says when it is turned on or off, a step
 * is skipped, and a supply is handed out or refused. Ids, tables and columns stay `thepath`.
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

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

select pg_temp.patch_fn('rpc_thepath(uuid, boolean)',
  $o$'Path: on. Journal, Path tab.' else 'Path: off.'$o$,
  $n$'Guiding Light: on. Journal, Guiding Light tab.' else 'Guiding Light: off.'$n$);

select pg_temp.patch_fn('rpc_thepath_skip(uuid, text, boolean)',
  $o$'p_step: not a step of the Path'$o$,
  $n$'p_step: not a step of the Guiding Light'$n$);
select pg_temp.patch_fn('rpc_thepath_skip(uuid, text, boolean)',
  $o$raise exception 'Path: off.'$o$,
  $n$raise exception 'Guiding Light: off.'$n$);

select pg_temp.patch_fn('rpc_thepath_supply(uuid, text)',
  $o$'p_step: not a tame step of the Path'$o$,
  $n$'p_step: not a tame step of the Guiding Light'$n$);
select pg_temp.patch_fn('rpc_thepath_supply(uuid, text)',
  $o$raise exception 'Path: off.'$o$,
  $n$raise exception 'Guiding Light: off.'$n$);
select pg_temp.patch_fn('rpc_thepath_supply(uuid, text)',
  $o$'Path supply: $o$,
  $n$'Guiding Light supply: $n$, 4);

select private.lock_doors();
