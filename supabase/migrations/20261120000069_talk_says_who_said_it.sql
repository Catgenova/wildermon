/*
 * Talk from before you came ashore says who said it.
 *
 * Asked for: trade and class icons before players' names in chat, over their
 * heads and in the Social window. A line of talk that comes down live has
 * always carried `said_by`; the lines `rpc_chat` hands back on arriving were
 * only their number, words and hour, so the browser could not say whose
 * icons go before them. Now each carries `by`, the speaker's uid, as the live
 * ones do.
 *
 * Nothing else is sent: the trade and class themselves are read off the
 * `player` rows every islander may already read (`craft_class`,
 * `combat_class`), by the roster's read of everybody ashore and, for a speaker
 * who is not, by one read of their row (`src/game/badges.ts`).
 */
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

select pg_temp.patch_fn('public.rpc_chat(uuid,integer)'::regprocedure,
  $o$jsonb_build_object('n', q.n, 'text', q.text, 'at', q.at)$o$,
  $n$jsonb_build_object('n', q.n, 'text', q.text, 'at', q.at, 'by', q.said_by)$n$);
select pg_temp.patch_fn('public.rpc_chat(uuid,integer)'::regprocedure,
  $o$select e.n, e.text, e.at from event e$o$,
  $n$select e.n, e.text, e.at, e.said_by from event e$n$);

select private.lock_doors();
