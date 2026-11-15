/*
 * A woven rug's pattern let through the door.
 *
 * Reported: "error making rug" — "Not done: Bad request: rpc_act p_target.pattern: not a key." The crafting window sends
 * the pattern chosen on a woven rug's row in the craft's target (`craft.ts`), and `perform_craft` reads it, but
 * `spec_target` never listed it, so `check_args` refused every woven rug with a pattern before it was looked at.
 */
set local lock_timeout = '5s';

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

select pg_temp.patch_fn('private.spec_target()',
  '"brew": {"t": "text"}, "dyeFrom": {"t": "text"}, "patron": {"t": "text"},',
  '"brew": {"t": "text"}, "dyeFrom": {"t": "text"}, "patron": {"t": "text"}, "pattern": {"t": "text", "len": 32},');

select private.lock_doors();
