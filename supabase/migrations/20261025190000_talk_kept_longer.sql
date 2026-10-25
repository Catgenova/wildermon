/*
 * Talk kept longer, and more of it handed to somebody arriving.
 *
 * Reported: "the total logged messages of any kind reaches a limit and it
 * empties out the Talk tab." The browser kept one list of every line, so a
 * worker's run of work lines pushed the last thing anybody said out of it
 * (`trimLog` now keeps talk apart). And the island kept chat a day, like
 * every other line, and handed back sixty lines of it on arriving.
 *
 * Now what is said aloud is kept `chat_keep` (three of `event_keep`'s days),
 * and up to `chat_lines` of it is handed back (`recentChat`, `TALK_LOG`).
 */
set local lock_timeout = '3s';

/* Seconds a line said aloud is kept: three of the days every other line is. */
create or replace function chat_keep() returns double precision
language sql immutable as $$ select 3 * event_keep() $$;

/* Lines said aloud handed back at most on arriving (`TALK_LOG`). */
create or replace function chat_lines() returns int
language sql immutable as $$ select 400 $$;

create or replace function prune_events(p_world uuid) returns integer
language plpgsql as $$
declare v_n int;
begin
  with old as (
    select world_id, n from event
    where world_id = p_world and at < now() - make_interval(secs => event_keep())
      -- What was said aloud for everybody, kept the longer (`chat_keep`).
      and (kind <> 'chat' or uid is not null or at < now() - make_interval(secs => chat_keep()))
    order by n limit sweep_rows()
  )
  delete from event e using old where e.world_id = old.world_id and e.n = old.n;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

do $do$
declare v_def text; v_old text; v_n int;
begin
  v_def := pg_get_functiondef('rpc_chat'::regproc);
  v_old := $$least(greatest(coalesce(p_limit, 60), 1), 200)$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_chat has % of its cap, not 1', v_n; end if;
  execute replace(v_def, v_old, $$least(greatest(coalesce(p_limit, 60), 1), chat_lines())$$);
end $do$;

select private.lock_doors();
