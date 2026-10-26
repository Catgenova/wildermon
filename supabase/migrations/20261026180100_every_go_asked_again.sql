/*
 * Every go asked again.
 *
 * `settle` asked a job's refusal again only between one go and the next of a
 * run, never before the go it was about to do. So the first go of every job,
 * and a go of a run whose state changed while it waited, ran on whatever was
 * left: a dig with the shovel gone dug, a dig with no wind left dug, a job a
 * walk had taken out of reach was done from there. Every go is now asked
 * `act_refusal` first -- the refusal `rpc_act` asks, of the job's own target
 * and the body as it is at the go -- unless this call asked it a moment ago
 * (after the go before, or as the job came off the queue):
 *
 *   * refused, the go is not done, takes no wind, and the run stops: its doer
 *     is told "<Label>: <refusal> Left: N.", and the next job in the line is
 *     asked for, as when a run stops;
 *   * a fight is not asked: it ends when it is over or out of reach, in its
 *     own words (`perform_fight`), as before.
 *
 * And a storey job keeps the storey it was asked on. A plan or a build on a
 * building's tile read its storey off the building's work level at the go;
 * the menu names the storey it was shown for (`level`), but an ask that names
 * none -- a hidden door's, a queued one from before -- landed on whatever
 * storey was being worked when its turn came, and was now refused there. So
 * `rpc_act` writes the storey into the target of a storey job that names none
 * (`private.keep_job_level`), the one `frame_job_level` reads at the ask, and
 * the go is asked and done on that storey. The browser does the same
 * (`keepJobLevel`, `src/game/buildActions.ts`).
 */
set local lock_timeout = '3s';

/** The jobs done on one storey of a building, whose storey a target names: the browser's `STOREY_JOBS`. */
create or replace function private.storey_job(p_action text) returns boolean language sql immutable as $fn$
  select p_action in ('plan_wall', 'plan_fence', 'build_wall', 'remove_wall', 'plan_floor', 'build_floor', 'remove_floor',
                      'paint_wall', 'strip_wall_paint', 'paint_floor', 'repoint_wall', 'no_plan', 'mark_out')
      or frame_action(p_action)
$fn$;

/**
 * A storey job's target with the storey it is asked on written into it, where it names none: the storey
 * `frame_job_level` reads now, on the building on that tile or the one it names (`buildingId`). A terrace's
 * wall is on its roof's level and a roof on its own, whatever the target says, and are left as they are.
 */
create or replace function private.keep_job_level(p_world uuid, p_action text, p_target jsonb) returns jsonb
language plpgsql stable as $fn$
declare b building; v_x int; v_y int;
begin
  if not private.storey_job(p_action) or jsonb_typeof(p_target) is distinct from 'object'
     or p_target->>'kind' is distinct from 'tile' or p_target ? 'level'
     or coalesce((p_target->>'terrace')::boolean, false) or p_target->>'floorKind' = 'roof'
     or jsonb_typeof(p_target->'x') is distinct from 'number' or jsonb_typeof(p_target->'y') is distinct from 'number' then
    return p_target;
  end if;
  v_x := floor((p_target->>'x')::numeric)::int;
  v_y := floor((p_target->>'y')::numeric)::int;
  select * into b from building
   where world_id = p_world
     and id = coalesce(building_at(p_world, v_x, v_y),
                       case when jsonb_typeof(p_target->'buildingId') = 'number'
                            then frame_host(p_world, v_x, v_y, (p_target->>'buildingId')::int) end);
  if not found then return p_target; end if;
  return p_target || jsonb_build_object('level', frame_job_level(b, p_target));
end $fn$;

revoke all on function private.storey_job(text), private.keep_job_level(uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- the patches, each exactly once
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'settle(uuid,uuid)'::regprocedure,
     $$        v_mark bigint; -- every job says how it ended$$,
     $$        v_mark bigint; -- every job says how it ended
        v_stop text; v_asked boolean := false; -- every go asked again$$),
    -- Asked before the go, unless this call asked it a moment ago (`v_asked`). Not a fight.
    (2, 'settle(uuid,uuid)'::regprocedure,
     $$      guard := guard + 1;
$$, $$      guard := guard + 1;
      -- Every go asked again: its tool, its stuff, its target, the wind and the reach, as `rpc_act` asks them.
      v_stop := case when v_asked or is_fight(p.act) then null else act_refusal(p_world, p_uid, p.act, p.act_target) end;
      v_asked := false;
$$),
    -- A refused go is not done.
    (3, 'settle(uuid,uuid)'::regprocedure,
     $$      v_mark := coalesce((select max(e.n) from event e where e.world_id = p_world), 0); -- every job says how it ended
      perform act_perform(p_world, p_uid, p.act, p.act_target);
      if not exists (select 1 from event e where e.world_id = p_world and e.n > v_mark
                       and (e.uid = p_uid or e.uid is null)) then
        perform tell(p_world, p_uid, private.go_unsaid(p_world, p_uid, p.act, p.act_target), 'error');
      end if;
$$, $$      if v_stop is null then -- every go asked again
      v_mark := coalesce((select max(e.n) from event e where e.world_id = p_world), 0); -- every job says how it ended
      perform act_perform(p_world, p_uid, p.act, p.act_target);
      if not exists (select 1 from event e where e.world_id = p_world and e.n > v_mark
                       and (e.uid = p_uid or e.uid is null)) then
        perform tell(p_world, p_uid, private.go_unsaid(p_world, p_uid, p.act, p.act_target), 'error');
      end if;
      end if;
$$),
    -- Nor does it take wind, or say what the baubles made of it.
    (4, 'settle(uuid,uuid)'::regprocedure,
     $$      perform bauble_said(p_world, p_uid);
$$, $$      if v_stop is null then perform bauble_said(p_world, p_uid); end if; -- every go asked again
$$),
    (5, 'settle(uuid,uuid)'::regprocedure,
     $$      perform spend_wind(p_world, p_uid, p.act);
$$, $$      if v_stop is null then perform spend_wind(p_world, p_uid, p.act); end if; -- every go asked again
$$),
    -- A run goes on only from a go that was done, and its next go was asked just now.
    (6, 'settle(uuid,uuid)'::regprocedure,
     $$      if p.act_left > 1 and act_refusal(p_world, p_uid, p.act, p.act_target) is null then
$$, $$      if v_stop is null and p.act_left > 1 and act_refusal(p_world, p_uid, p.act, p.act_target) is null then
        v_asked := true; -- every go asked again
$$),
    -- The refusal of a go not done, with the goes left, as a run that stops says it.
    (7, 'settle(uuid,uuid)'::regprocedure,
     $$        if p.act_left > 1 and not is_fight(p.act) then
$$, $$        if v_stop is not null then -- every go asked again
          perform tell(p_world, p_uid, coalesce(d.label || ': ', '') || v_stop || ' Left: ' || coalesce(p.act_left, 1) || '.', 'error');
        elsif p.act_left > 1 and not is_fight(p.act) then
$$),
    -- A job just taken off the queue was asked just now.
    (8, 'settle(uuid,uuid)'::regprocedure,
     $$            perform tell(p_world, p_uid, upper(left(d.verb, 1)) || substr(d.verb, 2) || '.', 'info');
            exit;
$$, $$            perform tell(p_world, p_uid, upper(left(d.verb, 1)) || substr(d.verb, 2) || '.', 'info');
            v_asked := true; -- every go asked again
            exit;
$$),
    -- A storey job keeps the storey it was asked on, judged and queued and done there.
    (9, 'rpc_act(uuid,text,jsonb,integer)'::regprocedure,
     $$  why := act_refusal(p_world, me, p_action, p_target);
  if why is not null then
    perform tell(p_world, me, why, 'error');
$$, $$  -- Every go asked again: on the storey it was asked on (`private.keep_job_level`).
  p_target := private.keep_job_level(p_world, p_action, p_target);
  why := act_refusal(p_world, me, p_action, p_target);
  if why is not null then
    perform tell(p_world, me, why, 'error');
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
