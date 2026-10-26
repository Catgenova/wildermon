/*
 * Every job says how it ended.
 *
 * Reported: "Sometimes an action completes or fails with no description in
 * the event log." Measured on a test island, every action in `action_def`
 * against a tile, a thing in the pack and a thing that is gone, with the job
 * already due: of 7,469 goes, 4,976 told whoever did them nothing at all,
 * over 625 of the 679 actions. `settle` does a job's go on whatever is left
 * by the time it comes round -- its tool, its stuff or its target can have
 * gone since it was asked for, to somebody else's hands or the go before --
 * and a performer that finds nothing to work on returns from one of its
 * guards (`if ... then return; end if;`, 308 of them) without a word.
 *
 *   * A go that told whoever did it nothing at all tells them, after the
 *     job's label, what the job would be refused for now, or that nothing
 *     was done (`private.go_unsaid`): "Eat: It is gone.", "Collect: nothing
 *     done." Nothing about what a go does changes.
 *   * A run that stops for a refusal names its job: "Dig: Need a shovel. Left: 4."
 *   * Stop and walking off say what was put down (`rpc_cancel`, `rpc_hold`):
 *     "Stopped digging. Queue cleared: 2 actions.", "Stopped digging. Queue held: 3."
 *   * `rpc_join` says where the island's lines stood when you arrived
 *     (`saidTo`), so the browser's beat counts from there rather than from its
 *     first beat, and a line told between the two is not stepped over.
 */
set local lock_timeout = '3s';

/** What a go that said nothing says: its job's label, and what it would be refused for now, or that nothing was done. */
create or replace function private.go_unsaid(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql as $fn$
begin
  return coalesce((select d.label from action_def d where d.id = p_action) || ': ', '')
      || coalesce(act_refusal(p_world, p_uid, p_action, p_target), 'nothing done.');
end $fn$;

revoke all on function private.go_unsaid(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- the patches, each exactly once
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'settle(uuid,uuid)'::regprocedure,
     $$declare p player; d action_def; done int := 0; guard int := 0; nxt jsonb; ended timestamptz;$$,
     $$declare p player; d action_def; done int := 0; guard int := 0; nxt jsonb; ended timestamptz;
        v_mark bigint; -- every job says how it ended$$),
    -- A go that told whoever did it nothing says so (`private.go_unsaid`).
    (2, 'settle(uuid,uuid)'::regprocedure,
     $$      perform act_perform(p_world, p_uid, p.act, p.act_target);
$$, $$      v_mark := coalesce((select max(e.n) from event e where e.world_id = p_world), 0); -- every job says how it ended
      perform act_perform(p_world, p_uid, p.act, p.act_target);
      if not exists (select 1 from event e where e.world_id = p_world and e.n > v_mark
                       and (e.uid = p_uid or e.uid is null)) then
        perform tell(p_world, p_uid, private.go_unsaid(p_world, p_uid, p.act, p.act_target), 'error');
      end if;
$$),
    -- A run stopped for a refusal names its job, as a go that said nothing does.
    (3, 'settle(uuid,uuid)'::regprocedure,
     $$            coalesce(act_refusal(p_world, p_uid, p.act, p.act_target) || ' Left: '$$,
     $$            coalesce(coalesce(d.label || ': ', '') || act_refusal(p_world, p_uid, p.act, p.act_target) || ' Left: '$$),
    -- Stop says what it put down.
    (4, 'rpc_cancel(uuid)'::regprocedure,
     $$  return jsonb_build_object('stopped', had is not null, 'was', had, 'dropped', dropped);
$$, $$  -- Every job says how it ended: what was in hand, and what was lined up behind it.
  perform tell(p_world, me, concat_ws(' ',
    case when had is not null then 'Stopped ' || coalesce((select d.verb from action_def d where d.id = had), 'working') || '.' end,
    case when dropped > 0 then 'Queue cleared: ' || dropped || case when dropped = 1 then ' action.' else ' actions.' end end), 'info');
  return jsonb_build_object('stopped', had is not null, 'was', had, 'dropped', dropped);
$$),
    -- And walking off says what it put down to come back to.
    (5, 'rpc_hold(uuid)'::regprocedure,
     $$  return jsonb_build_object('held', had is not null, 'was', had, 'waiting', p.act_left);
$$, $$  -- Every job says how it ended: what was in hand, and how many wait in the queue.
  if had is not null then
    perform tell(p_world, me, 'Stopped ' || coalesce((select d.verb from action_def d where d.id = had), 'working') || '.'
      || case when coalesce(p.act_left, 0) > 0 then ' Queue held: ' || p.act_left || '.' else '' end, 'info');
  end if;
  return jsonb_build_object('held', had is not null, 'was', had, 'waiting', p.act_left);
$$),
    -- Where the lines stood when you arrived, for the beat to count from (`Island.join`).
    (6, 'rpc_join(uuid,text)'::regprocedure,
     $$    'hears', true,
$$, $$    'hears', true,
    -- Every job says how it ended: the beat counts lines from here, rather than from its own first answer.
    'saidTo', (select coalesce(max(e.n), 0) from event e where e.world_id = p_world),
$$)
  ) as t(ord, fn, old, new) order by ord loop
    v_def := pg_get_functiondef(r.fn);
    continue when position(r.new in v_def) > 0;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of change %, not 1', r.fn, v_n, r.ord; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
