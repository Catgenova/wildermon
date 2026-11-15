/*
 * Stop the job in hand, start the next one waiting.
 *
 * Asked for: "add an x to stop the current process and begin next in queue".
 * The queue window's job in hand had no button, and the one way to stop it,
 * Stop (`rpc_cancel`), empties `act_queue` as well. So:
 *
 *   * `rpc_skip(p_world)`: what is due is settled first, as `rpc_cancel`
 *     settles it; then the job in hand is dropped with every go left of it,
 *     said as Stop says it ("Stopped <verb>."), and the next job waiting is
 *     started from now exactly as `settle` starts one when a job ends: the
 *     first in the line that can be done, a refused one told and put out of
 *     the line, another of the same stack standing in (`act_retarget`), its
 *     goes carried, its pace as `settle` reckons it, "<Verb>." said. The rest
 *     of the queue stays as it was.
 *   * With nothing waiting it is Stop without a queue to clear.
 *   * A job that follows a run of its own (`private.job_follow`) does not
 *     follow it here: what is stopped is stopped.
 *   * It answers with the list as it now is, in `rpc_act`'s shape.
 */

set local lock_timeout = '3s';

-- The next job off the front of the line, started at `p_at`: `settle`'s own step once a job has ended.
create or replace function private.queue_next(p_world uuid, p_uid uuid, p_at timestamptz) returns text
  language plpgsql set search_path = public as $fn$
declare p player; d action_def; nxt jsonb;
begin
  select * into p from player where world_id = p_world and uid = p_uid for update;
  if not found or p.act is not null then return null; end if;
  loop
    nxt := p.act_queue -> 0;
    -- Another onion will do (`act_retarget`).
    nxt := act_retarget(p_world, p_uid, nxt);
    if nxt is null then return null; end if;
    select * into d from action_def where id = nxt->>'action';
    if d is null or act_refusal(p_world, p_uid, nxt->>'action', nxt->'target') is not null then
      perform tell(p_world, p_uid,
        coalesce(act_refusal(p_world, p_uid, nxt->>'action', nxt->'target'), 'That cannot be done now.'), 'error');
      update player set act_queue = act_queue - 0
        where world_id = p_world and uid = p_uid returning * into p;
      -- And the one behind it.
    else
      update player set act = nxt->>'action', act_target = nxt->'target',
             act_left = greatest(1, coalesce((nxt->>'goes')::int, 1)),
             act_goes = greatest(1, coalesce((nxt->>'goes')::int, 1)),
             act_started = p_at,
             act_ends = p_at + make_interval(secs => go_secs(d.id,
               act_base(p_world, p_uid, d.id, d.base_time),
               case when d.skill is null then 50 else skill_of(p_world, p_uid, d.skill) end,
               job_tool_ql(coalesce(p.class_mul, '{}'::jsonb), p_world, p_uid, d.id, d.tool),
               control_speed(p_world, p_uid)
                 * class_mul(coalesce(p.class_mul, '{}'::jsonb), 'hands',
                             act_scope(p_world, p_uid, d.skill)) * bauble_pace(p_world, p_uid, d.skill),
               swing_burden(p_world, p_uid, d.id))
               * perk_time(coalesce(p.class_mul, '{}'::jsonb), p_world, d.id, nxt->'target')
               * piece_pace(p_world, p_uid, d.skill) * faith_steady(p_world, p_uid, d.tool)
               * rope_pace(p_world, p_uid, d.id, d.skill)),
             act_queue = act_queue - 0
        where world_id = p_world and uid = p_uid;
      perform tell(p_world, p_uid, upper(left(d.verb, 1)) || substr(d.verb, 2) || '.', 'info');
      return d.id;
    end if;
  end loop;
end $fn$;

create or replace function rpc_skip(p_world uuid) returns jsonb
  language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); p player; had text; v_next text;
begin
  perform private.pace(auth.uid(), 'act');
  perform private.once();
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  -- What is due is done. Stopping is for what is still in your hands.
  perform settle(p_world, me);
  select * into p from player where world_id = p_world and uid = me for update;
  if not found then return jsonb_build_object('stopped', false, 'queue', '[]'::jsonb); end if;
  had := p.act;
  if had is not null then
    update player set
        act = null, act_target = null, act_started = null, act_ends = null,
        act_left = null, act_goes = null, seen_at = now()
      where world_id = p_world and uid = me;
    perform tell(p_world, me, 'Stopped ' || coalesce((select d.verb from action_def d where d.id = had), 'working') || '.', 'info');
  end if;
  v_next := private.queue_next(p_world, me, now());
  select * into p from player where world_id = p_world and uid = me;
  return jsonb_build_object('stopped', had is not null, 'was', had, 'next', v_next,
    'capacity', queue_capacity(p_world, me),
    'queue', coalesce((select jsonb_agg(jsonb_build_object(
                         'action', q->>'action',
                         'goes', greatest(1, coalesce((q->>'goes')::int, 1))) order by o)
                       from jsonb_array_elements(p.act_queue) with ordinality t(q, o)), '[]'::jsonb));
end $fn$;

select private.lock_doors();

notify pgrst, 'reload schema';
