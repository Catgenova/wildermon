/*
 * A queue put in order.
 *
 * Asked for: a list of everything queued, current job first, whose waiting
 * jobs can be dragged into another order and taken out with a cross. The
 * queue is `player.act_queue` and nothing could change it but `rpc_act`
 * (adding to the end), `settle` (taking off the front), `rpc_hold` (putting
 * the job in hand back at the front) and `rpc_cancel` (emptying it). So:
 *
 *   * `rpc_queue_order(p_world, p_seen, p_order)`: `p_seen` is the list as
 *     the browser drew it, each job's `action` and `goes`, the shape every
 *     answer says it in; `p_order` the places in it, from nought, in the
 *     order they are to go, a place left out being a job put out of mind.
 *   * Refused, in the browser's words (`src/game/jobqueue.ts`), when the list
 *     is no longer what was seen -- the job in hand finished and the next came
 *     off the front between the drawing and the drag -- and when the order is
 *     not a set of places in it. Nothing is moved either way.
 *   * The job in hand is `player.act`, which is never in `act_queue`, so no
 *     order can move it. A job put down by a walk (`rpc_hold`) is in the list
 *     and is no longer in hand, and moves like any other.
 *   * A job taken out is said as `clearQueue` says the lot: "You put <job>
 *     out of your mind." for one, "You put <n> jobs out of your mind." for more.
 *   * It answers with the list as it now is, in `rpc_act`'s shape, so the
 *     browser's list is the island's again whether it was refused or not.
 */

set local lock_timeout = '3s';

create or replace function rpc_queue_order(p_world uuid, p_seen jsonb, p_order int[]) returns jsonb
  language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); p player; v_now jsonb; n int; why text; cap int; v_dropped text[];
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  -- What is due is done first: a job that came off the front is not in the list any more.
  perform settle(p_world, me);
  select * into p from player where world_id = p_world and uid = me for update;
  if not found then return jsonb_build_object('ordered', false, 'queue', '[]'::jsonb); end if;
  n := coalesce(jsonb_array_length(p.act_queue), 0);
  v_now := coalesce((select jsonb_agg(jsonb_build_object(
                       'action', q->>'action',
                       'goes', greatest(1, coalesce((q->>'goes')::int, 1))) order by o)
                     from jsonb_array_elements(p.act_queue) with ordinality t(q, o)), '[]'::jsonb);
  cap := queue_capacity(p_world, me);
  if p_seen is distinct from v_now then
    why := 'The jobs waiting changed before that arrived: nothing was moved.';
  elsif p_order is null
     or exists (select 1 from unnest(p_order) k where k is null or k < 0 or k >= n)
     or (select count(*) <> count(distinct k) from unnest(p_order) k) then
    why := 'That is not an order of the jobs waiting: nothing was moved.';
  end if;
  if why is not null then
    perform tell(p_world, me, why, 'error');
    return jsonb_build_object('ordered', false, 'why', why, 'queue', v_now, 'capacity', cap);
  end if;
  select array_agg(coalesce(d.label, q->>'action') order by o) into v_dropped
    from jsonb_array_elements(p.act_queue) with ordinality t(q, o)
    left join action_def d on d.id = q->>'action'
   where (o - 1)::int <> all (p_order);
  update player set act_queue = coalesce((select jsonb_agg(p.act_queue -> k order by o)
                                            from unnest(p_order) with ordinality u(k, o)), '[]'::jsonb)
    where world_id = p_world and uid = me returning * into p;
  if coalesce(array_length(v_dropped, 1), 0) = 1 then
    perform tell(p_world, me, 'You put ' || lower(v_dropped[1]) || ' out of your mind.', 'info');
  elsif coalesce(array_length(v_dropped, 1), 0) > 1 then
    perform tell(p_world, me, 'You put ' || array_length(v_dropped, 1) || ' jobs out of your mind.', 'info');
  end if;
  return jsonb_build_object('ordered', true, 'capacity', cap,
    'queue', coalesce((select jsonb_agg(jsonb_build_object(
                         'action', q->>'action',
                         'goes', greatest(1, coalesce((q->>'goes')::int, 1))) order by o)
                       from jsonb_array_elements(p.act_queue) with ordinality t(q, o)), '[]'::jsonb));
end $fn$;

select private.lock_doors();

notify pgrst, 'reload schema';
