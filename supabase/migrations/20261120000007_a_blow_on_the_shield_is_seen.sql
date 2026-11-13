-- A blow taken on a shield, as everybody near sees it.
--
-- Asked for: the blocking body plays a short block (`src/sculpt/anim/clips/block.ts`), seen by the blocker and by every
-- other player nearby. A block was a line told to the blocker alone (`BLOCKED_SAID`), and nothing on the body said it.
--
-- `player.blocked_at` is when the last blow was taken on the shield worn (`hurt_player`, the block's branch): one write
-- on the row the blow already holds. Never from the browser's say-so. The beat says it to the blocker (`rpc_settle`'s
-- `blocked_at`, with the line itself as the faster word), whose body broadcast carries it to everybody watching with
-- `act`; other browsers also read it with the rest of the roster (`PEOPLE_COLUMNS`). A blow dodged, warded or landed
-- leaves it as it was.

set local lock_timeout = '3s';

alter table player add column if not exists blocked_at timestamptz;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('public', 'hurt_player',
     $$        perform tell(p_world, p_uid, 'Blocked with shield.', 'fight');$$,
     $$        perform tell(p_world, p_uid, 'Blocked with shield.', 'fight');
        -- And when, for the body drawn blocking (`player.blocked_at`).
        update player set blocked_at = now() where world_id = p_world and uid = p_uid;$$),
    ('public', 'rpc_settle',
     $$    'act_tool', p.act_tool,$$,
     $$    'act_tool', p.act_tool,
    'blocked_at', p.blocked_at,$$)
  ) as t(sch, fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '%.% has % of the lines to change, not 1', r.sch, r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
