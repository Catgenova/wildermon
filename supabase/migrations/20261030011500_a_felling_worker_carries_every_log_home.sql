-- A felling worker carries every log of the tree home, not one.
--
-- Asked: "Fix the woodcutting wildermon to carry all logs to storage on cut down instead of just 1". A Sapgnaw's
-- felling (`worker_do`, 'woodcut') handed it one log and dropped the rest at the stump for somebody else to carry.
-- Now the load it carries home is the whole tree's logs; its line's third-stage `more` (`perk_more`) still adds to it.
-- The browser's `finishFelling` the same.

set local lock_timeout = '3s';

do $do$
declare v text; v_n int;
  v_old text := $o$    -- It can only carry one at a time; the rest of the tree waits at the stump.
    if logs > 1 then
      perform drop_on_ground(p_world, wx, wy, 'log', made_ql, tree.name, logs - 1);
    end if;
    return jsonb_build_object('def', 'log', 'count', 1, 'ql', made_ql, 'extra', tree.name);
$o$;
  v_new text := $n$    -- Every log of the tree home in one trip.
    return jsonb_build_object('def', 'log', 'count', logs, 'ql', made_ql, 'extra', tree.name);
$n$;
begin
  select pg_get_functiondef('worker_do'::regproc) into v;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'worker_do has % of the lines to change, not 1', v_n; end if;
  execute replace(v, v_old, v_new);
end $do$;

select private.lock_doors();
