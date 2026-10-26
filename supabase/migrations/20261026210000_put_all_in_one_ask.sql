/*
 * Put all in, in one ask; and a clock that waits on nobody.
 *
 * Reported: "Did I crash the server trying to transfer all of my relics to the
 * cart at once?" One round of `world_tick` took 116 s, the next 11.7 s, and the
 * island stood still for both; twenty minutes later another of 22 s, and the
 * clock's one failure that hour a statement timeout in the wild-creature scan
 * of `fight_target`. Three things, each fixed here:
 *
 *   * Put all in sent one `rpc_act` a stack, all at once: a pack of 150 relics
 *     was 150 asks, each settling the body twice, asking its refusal, and
 *     answering with the whole pack and every crate at the elbow (95 kB a
 *     time), every one of them in line behind the body's row and its `caller`
 *     row. The pace (`private.pace`, 5 a second, 60 at once) refused the 61st
 *     on: "Too many requests", ninety times over, and most of the pack stayed
 *     where it was. `rpc_act_many` takes up to `act_many_most()` things in one
 *     ask: one knock, one settle, the body's row held once, each thing asked of
 *     `act_refusal` and done by its own performer (`private.area_go`, as
 *     `settle` does a go: the go's source, whose go, its perks), one line for
 *     the lot, one answer with the pack. Only the instant moves between a pack
 *     and a store (`private.act_many_job`); with a job in hand nothing is done
 *     and the answer says `busy`, and the browser asks one at a time as
 *     before, to be queued behind it.
 *
 *   * A guard's look round for whatever hurt somebody read every wild thing on
 *     the island, worked out where each one is (`creature_x`), and asked of
 *     each whether any body on the island was last hurt by it -- for every
 *     guard, every beat of its day, up to 120 beats a call. It asks for the
 *     few it could be now: the one that hurt the guard, and the ones that hurt
 *     somebody lately, by their ids. And `wild_quarry`, every hunter's and
 *     guard's look round its ground, reads the wild things whose leg crosses
 *     the square it looks over, off an index of their legs
 *     (`creature_wild_leg`): a thing is somewhere on its leg, so none that
 *     could be in range is missed.
 *
 *   * `world_tick` is one transaction for every island, and waited as long as
 *     it took for any row it wanted: a body's row held by its own asks, a
 *     creature by a door. Everybody it had settled already waited with it. A
 *     round now waits `private.tick_lock_wait()` for a row and no longer; a
 *     body, a wildermon or a block of the round that cannot have one is left
 *     for the next round (`busy` in `tick_time`), and the rest of the round
 *     goes on.
 *
 * And a go done by `rpc_act` on the spot (an instant job) is not asked its
 * refusal a second time by the `settle` that does it: `rpc_act` asked it a
 * moment before, under the body's row (`wurm.asked`). That second asking came
 * with 20261026180100 and was a sixth of the cost of a put. And `room_mul`,
 * asked six times a thing put in, no longer plans its query over the list of
 * every enchantment each time it is asked.
 */
set local lock_timeout = '3s';

/** The most things one `rpc_act_many` moves: the browser's `ACT_MANY_MOST`. */
create or replace function act_many_most() returns int language sql immutable as $fn$ select 30 $fn$;

/** The jobs `rpc_act_many` does: the instant moves between a pack and a store. */
create or replace function private.act_many_job(p_action text) returns boolean language sql immutable as $fn$
  select p_action in ('store_in_crate', 'store_in_furniture', 'rack_put', 'stow_item', 'take_from_store')
$fn$;

/** How long a round of the clock waits for a row before it leaves that work to the next round. */
create or replace function private.tick_lock_wait() returns text language sql immutable as $fn$ select '300ms'::text $fn$;

/**
 * Whether the go `settle` is about to do was asked its refusal a moment ago, by the `rpc_act` that does it on the
 * spot (`wurm.asked`): read once, by the first `settle` after it was said, and gone, so no other body's go is let off.
 */
create or replace function private.asked_take() returns boolean language plpgsql as $fn$
declare v boolean := coalesce(current_setting('wurm.asked', true), '') = 'on';
begin
  if v then perform set_config('wurm.asked', '', true); end if;
  return v;
end $fn$;

revoke all on function private.act_many_job(text), private.tick_lock_wait(), private.asked_take() from public, anon, authenticated;

/**
 * Many things put in a store, or taken out of one, in one ask.
 *
 * Each as `rpc_act` would do it on the spot: asked of `act_refusal`, and done
 * by `act_perform` with the go's source and whose go it is set as `settle`
 * sets them (`private.area_go`), so a thing keeps everything it keeps when put
 * in by hand -- its kept pile, its rarity, where it came from -- and a store
 * takes what it has room for and no more. The line each would tell is held
 * back and one is told for the lot: moved, did not fit, refused.
 */
create or replace function rpc_act_many(p_world uuid, p_action text, p_targets jsonb) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); p player; d action_def; t jsonb; why text; first_why text; i int := 0;
        v_refused int := 0; v_moved int := 0; v_left int := 0; v_want int; v_after int; v_it item;
        v_was_hush text; v_line text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not coalesce(private.act_many_job(p_action), false) then
    perform private.bad_request('rpc_act_many', 'p_action: not one of its jobs');
  end if;
  if jsonb_typeof(p_targets) is distinct from 'array' or jsonb_array_length(p_targets) not between 1 and act_many_most() then
    perform private.bad_request('rpc_act_many', 'p_targets: 1 to ' || act_many_most() || ' things');
  end if;
  for t in select e from jsonb_array_elements(p_targets) e loop
    perform private.check_args('rpc_act_many', 'p_targets[' || i || ']', t, private.spec_target());
    if t->>'kind' is distinct from 'item' then
      perform private.bad_request('rpc_act_many', 'p_targets[' || i || '].kind: things only');
    end if;
    i := i + 1;
  end loop;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  perform settle(p_world, me);
  select * into p from player where world_id = p_world and uid = me for update;
  if not found then raise exception 'not on this island'; end if;
  -- A job in hand: nothing is done around it. Asked one at a time, they are queued behind it (`rpc_act`).
  if p.act is not null then
    return jsonb_build_object('started', false, 'busy', true);
  end if;
  update player set seen_at = now(), away = false where world_id = p_world and uid = me;
  select * into d from action_def where id = p_action;
  v_was_hush := coalesce(current_setting('wurm.hush', true), '');
  for t in select e from jsonb_array_elements(p_targets) e loop
    why := act_refusal(p_world, me, p_action, t);
    if why is not null then
      v_refused := v_refused + 1;
      first_why := coalesce(first_why, why);
      continue;
    end if;
    select * into v_it from item where world_id = p_world and id = target_item(t);
    v_want := greatest(1, least(coalesce(v_it.count, 1), coalesce((t->>'count')::int, 1)));
    perform set_config('wurm.hush', 'on', true);
    perform private.area_go(p_world, me, p_action, t);
    perform set_config('wurm.hush', v_was_hush, true);
    perform spend_wind(p_world, me, p_action);
    -- What is left of it where it was: the rest went.
    select q.count into v_after from item q
     where q.id = v_it.id and q.holder = v_it.holder and q.holder_uid is not distinct from v_it.holder_uid
       and q.crate is not distinct from v_it.crate and q.placed is not distinct from v_it.placed
       and q.inside is not distinct from v_it.inside;
    v_moved := v_moved + greatest(0, coalesce(v_it.count, 0) - coalesce(v_after, 0));
    v_left := v_left + greatest(0, v_want - greatest(0, coalesce(v_it.count, 0) - coalesce(v_after, 0)));
  end loop;
  v_line := case when v_moved > 0 then d.label || ': ' || v_moved || case when v_moved = 1 then ' thing.' else ' things.' end end;
  if v_left > 0 then v_line := concat_ws(' ', v_line, 'Did not fit: ' || v_left || '.'); end if;
  if v_refused > 0 then v_line := concat_ws(' ', v_line, 'Refused ' || v_refused || ': ' || first_why); end if;
  perform tell(p_world, me, coalesce(v_line, d.label || ': nothing done.'), case when v_moved > 0 then 'event' else 'error' end);
  return held_now(p_world, me) || jsonb_build_object('started', true, 'done', true, 'seconds', 0,
    'moved', v_moved, 'left', v_left, 'refused', v_refused,
    'why', case when v_moved = 0 then coalesce(first_why, case when v_left > 0 then 'Did not fit: ' || v_left || '.' end) end);
end $fn$;

/**
 * What a thing holding Deep Hold, True Axle or a Bag of Holding holds, times what it held. A thing with no
 * enchantment on it holds what it held, without the list of every enchantment read to say so, and a thing with one
 * reads it by a plan kept for the session (`plpgsql`) rather than one made each time: every store's room is asked
 * this, six times a thing put in.
 */
create or replace function room_mul(p_enchant jsonb) returns double precision language plpgsql immutable as $fn$
begin
  if p_enchant is null then return 1; end if;
  return 1 + coalesce((select greatest(0, least(ql_top(), (p_enchant->>'ql')::double precision)) * e.per_ql
                         from enchantments() e where e.id = p_enchant->>'id' and e.effect in ('room', 'bag')), 0);
end $fn$;

-- ------------------------------------------------------------------ the wild things a look round reads
create index if not exists creature_wild_leg on creature using gist (box(point(from_x, from_y), point(to_x, to_y)))
  where mode = 'wild' and hitched_to is null;

/** The nearest wild thing in range of a spot, of those whose leg crosses the square round it (`creature_wild_leg`). */
create or replace function public.wild_quarry(p_world uuid, p_cx double precision, p_cy double precision, p_range double precision,
                                              p_from_x double precision, p_from_y double precision)
returns creature language sql stable as $fn$
  select q.* from creature q
  where q.world_id = p_world and q.mode = 'wild' and q.hitched_to is null
    and box(point(q.from_x, q.from_y), point(q.to_x, q.to_y))
        && box(point(p_cx - p_range, p_cy - p_range), point(p_cx + p_range, p_cy + p_range))
    and greatest(abs(creature_x(q) - p_cx), abs(creature_y(q) - p_cy)) <= p_range
  order by (creature_x(q) - p_from_x) ^ 2 + (creature_y(q) - p_from_y) ^ 2, q.id
  limit 1
$fn$;

-- ---------------------------------------------------------------- the patches, each exactly once
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A guard's look round for what hurt somebody: those few, by id, not every wild thing on the island.
    (1, 'fight_target(uuid,integer)'::regprocedure, 1,
     $$      select * into q from creature qq where qq.world_id = p_world and qq.mode = 'wild'
        and qq.hitched_to is null
        and greatest(abs(creature_x(qq) - v_site.x), abs(creature_y(qq) - v_site.y)) <= v_rng
        and (c.hurt_by = qq.id
             or exists (select 1 from player pl where pl.world_id = p_world
                  and (pl.stats->>'hurtBy')::int = qq.id
                  and (pl.stats->>'hurtAt')::timestamptz > now() - make_interval(secs => blow_memory())))
$$,
     $$      select * into q from creature qq where qq.world_id = p_world
        -- The one that hurt it, and the ones that hurt somebody lately: by id (put all in).
        and qq.id in (select c.hurt_by where c.hurt_by is not null
                      union
                      select (pl.stats->>'hurtBy')::int from player pl where pl.world_id = p_world
                         and (pl.stats->>'hurtAt')::timestamptz > now() - make_interval(secs => blow_memory()))
        and qq.mode = 'wild'
        and qq.hitched_to is null
        and greatest(abs(creature_x(qq) - v_site.x), abs(creature_y(qq) - v_site.y)) <= v_rng
$$),
    -- An instant job's go is not asked again by the settle that does it: rpc_act asked it a moment ago.
    (2, 'rpc_act(uuid,text,jsonb,integer)'::regprocedure, 1,
     $$  if d.instant then
    perform settle(p_world, me);
$$, $$  if d.instant then
    perform set_config('wurm.asked', 'on', true); -- put all in: asked just now, under the body's row
    perform settle(p_world, me);
    perform set_config('wurm.asked', '', true);
$$),
    (3, 'settle(uuid,uuid)'::regprocedure, 1,
     $$        v_stop text; v_asked boolean := false; -- every go asked again$$,
     $$        v_stop text; v_asked boolean := private.asked_take(); -- every go asked again; put all in$$),
    -- The clock waits so long for a row and no longer.
    (4, 'world_tick()'::regprocedure, 1,
     $$        v_err text; v_state text; v_where text; v_faults int := 0;$$,
     $$        v_err text; v_state text; v_where text; v_faults int := 0;
        v_busy int := 0; v_was_wait text; -- put all in$$),
    (5, 'world_tick()'::regprocedure, 1,
     $$  v_t0 := clock_timestamp();
$$, $$  v_t0 := clock_timestamp();
  -- A row somebody holds is waited for so long and no longer: that work is the next round's (put all in).
  v_was_wait := coalesce(nullif(current_setting('lock_timeout', true), ''), '0');
  perform set_config('lock_timeout', private.tick_lock_wait(), true);
$$),
    (6, 'world_tick()'::regprocedure, 1,
     $$      v_settled := v_settled + settle(w.id, p.uid);
$$, $$      begin
        v_settled := v_settled + settle(w.id, p.uid);
      exception when lock_not_available then
        v_busy := v_busy + 1; -- put all in: this body's row is held; its work is the next round's
      end;
$$),
    (7, 'world_tick()'::regprocedure, 5,
     $$when deadlock_detected or lock_not_available or serialization_failure then raise;$$,
     $$when lock_not_available then v_busy := v_busy + 1; -- put all in
      when deadlock_detected or serialization_failure then raise;$$),
    (8, 'world_tick()'::regprocedure, 1,
     $$                       'faults', v_faults));$$,
     $$                       'faults', v_faults, 'busy', v_busy));$$),
    (9, 'world_tick()'::regprocedure, 1,
     $$  perform pg_advisory_unlock(hashtext('world_tick')::bigint);
$$, $$  perform set_config('lock_timeout', v_was_wait, true);
  perform pg_advisory_unlock(hashtext('world_tick')::bigint);
$$),
    -- A wildermon whose row is held is the next round's, and the rest of the sweep goes on.
    (10, 'kept_sweep(uuid,timestamp with time zone)'::regprocedure, 1,
     $$    if creature_settle(p_world, r.id) then n := n + 1; end if;
$$, $$    begin
      if creature_settle(p_world, r.id) then n := n + 1; end if;
    exception when lock_not_available then null; -- put all in: held; the next round's
    end;
$$),
    (11, 'worker_sweep(uuid,timestamp with time zone)'::regprocedure, 1,
     $$    if creature_settle(p_world, r.id) then n := n + 1; end if;
$$, $$    begin
      if creature_settle(p_world, r.id) then n := n + 1; end if;
    exception when lock_not_available then null; -- put all in: held; the next round's
    end;
$$)
  ) as t(ord, fn, times, old, new) order by ord loop
    v_def := pg_get_functiondef(r.fn);
    continue when position(r.new in v_def) > 0;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.times then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.times; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
